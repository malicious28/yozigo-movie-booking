import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, errorMessage } from '../api/client'
import { queries } from '../api/queries'
import type { Booking, Hold, SeatState } from '../api/types'
import { Countdown } from '../components/Countdown'
import { useRemainingMs } from '../hooks/useRemainingMs'
import { SeatMap } from '../components/SeatMap'
import { Alert, ErrorState, Modal, PageLoader } from '../components/ui'
import { formatLongDay, formatMoney, formatTime } from '../lib/format'
import { MAX_SEATS, sortSeats } from '../lib/seats'

type Payment = 'closed' | 'choose' | 'failed'
type Notice = { kind: 'error' | 'warning' | 'info'; text: string } | null

const seatsFrom = (err: unknown): string[] =>
  err instanceof ApiError && err.code === 'SEATS_UNAVAILABLE' ? ((err.details as { seats?: string[] })?.seats ?? []) : []

// The booking flow for one show:
//   choose seats -> Continue (server holds them for 5 min) -> Pay -> fake gateway -> booking.
// The server is the source of truth: the active hold is read from the polled seat map (so it also
// survives a page refresh), and seats taken by others are derived from it on every render.
export function ShowPage() {
  const showId = Number(useParams().id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const seatsKey = queries.seats(showId).queryKey

  const showQuery = useQuery(queries.show(showId))
  const seatsQuery = useQuery(queries.seats(showId))

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [payment, setPayment] = useState<Payment>('closed')
  const [notice, setNotice] = useState<Notice>(null)

  const states = useMemo(() => {
    const map: Record<string, SeatState> = {}
    for (const s of seatsQuery.data?.seats ?? []) map[s.label] = s.state
    return map
  }, [seatsQuery.data])

  const refreshSeats = () => qc.invalidateQueries({ queryKey: seatsKey })
  const setMyHold = (myHold: Hold | null) => qc.setQueryData(seatsKey, (old) => old && { ...old, myHold })

  // Difference between the server clock and ours, so the countdown follows the server.
  const clockOffset = seatsQuery.data ? new Date(seatsQuery.data.serverTime).getTime() - seatsQuery.dataUpdatedAt : 0
  const serverHold = seatsQuery.data?.myHold ?? null
  const remaining = useRemainingMs(serverHold?.expiresAt ?? null, clockOffset, () => {
    // The hold ran out without payment; the server has already freed the seats for everyone.
    setMyHold(null)
    setPicked(new Set())
    setPayment('closed')
    setNotice({ kind: 'error', text: 'Your 5-minute hold expired and the seats were released. Please choose your seats again.' })
    refreshSeats()
  })
  const hold = serverHold && remaining > 0 ? serverHold : null

  // Live updates: a seat I picked (but have not held yet) may be taken by someone else meanwhile.
  const lost = hold ? [] : [...picked].filter((l) => states[l] === 'held' || states[l] === 'booked')
  const selected = lost.length ? new Set([...picked].filter((l) => !lost.includes(l))) : picked

  const holdMutation = useMutation({
    mutationFn: (seats: string[]) => api.post<{ hold: Hold }>(`/shows/${showId}/hold`, { seats }),
    onSuccess: ({ hold }) => {
      setMyHold(hold)
      setPayment('closed')
      setNotice(null)
      refreshSeats()
    },
    onError: (err) => {
      const taken = seatsFrom(err)
      if (taken.length) setPicked(new Set([...selected].filter((l) => !taken.includes(l))))
      setNotice({ kind: 'error', text: errorMessage(err) })
      refreshSeats()
    },
  })

  const releaseMutation = useMutation({
    mutationFn: () => api.delete(`/shows/${showId}/hold`),
    onMutate: () => setPicked(new Set(hold?.seats)), // keep the seats selected so they can be adjusted
    onSettled: () => {
      setMyHold(null)
      refreshSeats()
    },
  })

  const bookMutation = useMutation({
    mutationFn: (seats: string[]) => api.post<{ booking: Booking }>('/bookings', { showId, seats }),
    onSuccess: ({ booking }) => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['movies'] })
      qc.removeQueries({ queryKey: seatsKey })
      navigate(`/bookings/${booking.id}`, { state: { justBooked: true } })
    },
    onError: (err) => {
      // Hold expired or seats lost: start over with a fresh map.
      setPayment('closed')
      setPicked(new Set())
      setMyHold(null)
      setNotice({ kind: 'error', text: errorMessage(err) })
      refreshSeats()
    },
  })

  if (showQuery.isPending || seatsQuery.isPending) return <PageLoader />
  if (showQuery.error) return <ErrorState error={showQuery.error} onRetry={showQuery.refetch} />
  if (seatsQuery.error) return <ErrorState error={seatsQuery.error} onRetry={seatsQuery.refetch} />

  const show = showQuery.data
  const chosen = hold ? hold.seats : sortSeats(selected)
  const total = chosen.length * show.pricePaise

  const toggle = (label: string) => {
    if (!selected.has(label) && selected.size >= MAX_SEATS) {
      setNotice({ kind: 'info', text: `You can select up to ${MAX_SEATS} seats per booking.` })
      return
    }
    setNotice(null)
    const next = new Set(selected)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    setPicked(next)
  }

  return (
    <>
      <Link to={`/movies/${show.movieId}`} className="back-link">
        ← {show.movieTitle}
      </Link>
      <div className="page-head">
        <h1>{show.movieTitle}</h1>
        <p className="muted">
          {formatLongDay(show.startsAt)} · {formatTime(show.startsAt)} · {formatMoney(show.pricePaise)} per seat
        </p>
      </div>

      <div className="booking-layout">
        <section className="card seatmap-card" aria-label="Choose seats">
          {show.started && <Alert kind="info">This show has already started, so it can no longer be booked.</Alert>}
          <SeatMap states={states} selected={hold ? undefined : selected} onToggle={hold || show.started ? undefined : toggle} />
          <p className="muted small center">Seat availability updates live.</p>
        </section>

        <aside className="card summary" aria-label="Booking summary">
          <h2 className="summary-title">Your seats</h2>
          {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
          {lost.length > 0 && <Alert kind="warning">Seat {sortSeats(lost).join(', ')} was just taken by someone else.</Alert>}
          {chosen.length === 0 ? (
            <p className="muted">Select up to {MAX_SEATS} seats on the map.</p>
          ) : (
            <dl className="summary-list">
              <dt>Seats</dt>
              <dd className="seats-text">{chosen.join(', ')}</dd>
              <dt>
                {chosen.length} × {formatMoney(show.pricePaise)}
              </dt>
              <dd className="total">{formatMoney(total)}</dd>
            </dl>
          )}

          {hold ? (
            <>
              <Countdown remainingMs={remaining} />
              <button className="btn btn-primary btn-block" onClick={() => setPayment('choose')}>
                Pay {formatMoney(total)}
              </button>
              <button className="btn btn-ghost btn-block" disabled={releaseMutation.isPending} onClick={() => releaseMutation.mutate()}>
                Change seats
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-block"
              disabled={chosen.length === 0 || holdMutation.isPending || show.started}
              onClick={() => holdMutation.mutate(chosen)}
            >
              {holdMutation.isPending ? 'Holding seats…' : 'Continue'}
            </button>
          )}
        </aside>
      </div>

      {payment !== 'closed' && hold && (
        <Modal title={payment === 'failed' ? 'Payment failed' : 'Payment'} onClose={() => !bookMutation.isPending && setPayment('closed')}>
          {payment === 'choose' ? (
            <>
              <p className="muted">
                This is a simulated payment gateway. No money is charged. Choose the outcome to test.
              </p>
              <p className="pay-amount">{formatMoney(total)}</p>
              <p className="small muted center">
                {show.movieTitle} · {hold.seats.join(', ')}
              </p>
              <div className="modal-actions">
                <button className="btn btn-danger-ghost" disabled={bookMutation.isPending} onClick={() => setPayment('failed')}>
                  Payment failure
                </button>
                <button className="btn btn-success" disabled={bookMutation.isPending} onClick={() => bookMutation.mutate(hold.seats)}>
                  {bookMutation.isPending ? 'Confirming…' : 'Payment success'}
                </button>
              </div>
            </>
          ) : (
            <>
              <Alert kind="error">Your payment did not go through and no booking was made.</Alert>
              <p className="muted">Your seats are still held, so you can try again before the timer runs out.</p>
              <Countdown remainingMs={remaining} />
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setPayment('closed')}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={() => setPayment('choose')}>
                  Try again
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
