import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, errorMessage } from '../api/client'
import { queries } from '../api/queries'
import type { Booking, Hold, SeatState, Show, SnackDelivery } from '../api/types'
import { Countdown } from '../components/Countdown'
import { SeatMap } from '../components/SeatMap'
import { SnackMenu, type Cart } from '../components/SnackMenu'
import { Alert, ErrorState, Modal, PageLoader, Poster } from '../components/ui'
import { useRemainingMs } from '../hooks/useRemainingMs'
import { dateKey, formatLongDay, formatMoney, formatTime } from '../lib/format'
import { heroGlow } from '../lib/hue'
import { MAX_SEATS, sortSeats } from '../lib/seats'

type Payment = 'closed' | 'choose' | 'failed'
type Notice = { kind: 'error' | 'warning' | 'info'; text: string } | null

const seatsFrom = (err: unknown): string[] =>
  err instanceof ApiError && err.code === 'SEATS_UNAVAILABLE' ? ((err.details as { seats?: string[] })?.seats ?? []) : []

// Checkout for one show, in three steps:
//   1. Seats  - pick seats; Continue asks the server to hold them for 5 minutes
//   2. Snacks - optional food & drinks delivered to the seat
//   3. Pay    - simulated gateway; success turns the hold into a booking
// The server is the source of truth: the active hold is read from the polled seat map (so it
// survives a page refresh), and seats taken by others are derived from it on every render.
export function ShowPage() {
  const showId = Number(useParams().id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const seatsKey = queries.seats(showId).queryKey

  const showQuery = useQuery(queries.show(showId))
  const seatsQuery = useQuery(queries.seats(showId))
  const snacksQuery = useQuery(queries.snacks())
  const movieId = showQuery.data?.movieId ?? 0
  const movieQuery = useQuery({ ...queries.movie(movieId), enabled: movieId > 0 })

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [cart, setCart] = useState<Cart>({})
  const [delivery, setDelivery] = useState<SnackDelivery>('show_start')
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

  const snackOrder = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, quantity]) => ({ snackId: Number(id), quantity }))

  const bookMutation = useMutation({
    mutationFn: (seats: string[]) =>
      api.post<{ booking: Booking }>('/bookings', { showId, seats, snacks: snackOrder, snackDelivery: delivery }),
    onSuccess: ({ booking }) => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['movies'] })
      qc.removeQueries({ queryKey: seatsKey })
      navigate(`/bookings/${booking.id}`, { state: { justBooked: true } })
    },
    onError: (err) => {
      setPayment('closed')
      // A snack problem leaves the hold intact, so the user can fix the order and retry.
      if (err instanceof ApiError && err.code === 'INVALID_SNACK') {
        qc.invalidateQueries({ queryKey: queries.snacks().queryKey })
        setCart({})
      } else {
        setPicked(new Set())
        setMyHold(null)
        refreshSeats()
      }
      setNotice({ kind: 'error', text: errorMessage(err) })
    },
  })

  if (showQuery.isPending || seatsQuery.isPending) return <PageLoader />
  const loadError = showQuery.error ?? seatsQuery.error
  if (loadError) {
    return (
      <div className="container main">
        <ErrorState error={loadError} />
      </div>
    )
  }

  const show = showQuery.data!
  const step = hold ? 'snacks' : 'seats'
  const chosen = hold ? hold.seats : sortSeats(selected)
  const ticketsTotal = chosen.length * show.pricePaise
  const snackLines = snackOrder.flatMap((o) => {
    const snack = snacksQuery.data?.find((s) => s.id === o.snackId)
    return snack ? [{ ...o, snack }] : []
  })
  const snacksTotal = snackLines.reduce((sum, l) => sum + l.snack.pricePaise * l.quantity, 0)
  const total = ticketsTotal + snacksTotal
  const freeSeats = Object.values(states).filter((s) => s === 'available').length
  const sameDayShows = (movieQuery.data?.shows ?? []).filter((s) => dateKey(s.startsAt) === dateKey(show.startsAt))

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
  const setQty = (snackId: number, quantity: number) => setCart((c) => ({ ...c, [snackId]: Math.max(0, quantity) }))
  const hasAlerts = Boolean(notice || lost.length || show.started)

  return (
    <>
      <section className="band checkout-head">
        <div className="band-glow" style={heroGlow(show.movieTitle)} />
        <div className="container checkout-head-inner">
          <div>
            <Link to={`/movies/${show.movieId}`} className="small" style={{ color: 'var(--on-ink-muted)' }}>
              ← Back to show times
            </Link>
            <h1>{show.movieTitle}</h1>
            <p className="meta">
              <span>{show.language}</span>
              <span className="dot">{formatLongDay(show.startsAt)}</span>
              <span className="dot">{formatTime(show.startsAt)}</span>
              <span className="dot">Screen 1</span>
            </p>
          </div>
          {sameDayShows.length > 1 && <TimeSwitch shows={sameDayShows} currentId={show.id} locked={!!hold} />}
        </div>
      </section>

      <div className="container main">
        <ol className="stepper" aria-label="Checkout steps">
          <li className={step !== 'seats' ? 'done' : undefined} aria-current={step === 'seats' ? 'step' : undefined}>
            Select seats
          </li>
          <li aria-current={step === 'snacks' && payment === 'closed' ? 'step' : undefined}>Add snacks</li>
          <li aria-current={payment !== 'closed' ? 'step' : undefined}>Pay</li>
        </ol>

        <div className="checkout-layout">
          <section className="card" aria-label={step === 'seats' ? 'Choose seats' : 'Add snacks'}>
            {hasAlerts && (
              <div style={{ marginBottom: 'var(--s4)' }}>
                {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
                {lost.length > 0 && <Alert kind="warning">Seat {sortSeats(lost).join(', ')} was just taken by someone else.</Alert>}
                {show.started && <Alert kind="info">This show has already started, so it can no longer be booked.</Alert>}
              </div>
            )}

            {step === 'seats' ? (
              <>
                <div className="panel-head">
                  <div>
                    <h2>Select your seats</h2>
                    <p className="muted small">
                      {freeSeats} of 80 seats available · up to {MAX_SEATS} per booking · updates live
                    </p>
                  </div>
                </div>
                <SeatMap
                  states={states}
                  selected={selected}
                  onToggle={show.started ? undefined : toggle}
                  caption={`${formatMoney(show.pricePaise)} · Standard`}
                />
              </>
            ) : (
              <>
                <div className="panel-head">
                  <div>
                    <h2>Grab a bite</h2>
                    <p className="muted small">Optional. Delivered to seat {hold!.seats[0]} so you don't miss a minute.</p>
                  </div>
                  {snackOrder.length > 0 && (
                    <button className="btn-link small" onClick={() => setCart({})}>
                      Clear snacks
                    </button>
                  )}
                </div>
                {snacksQuery.error ? (
                  <ErrorState error={snacksQuery.error} onRetry={snacksQuery.refetch} />
                ) : snacksQuery.data ? (
                  <SnackMenu snacks={snacksQuery.data} cart={cart} onChange={setQty} delivery={delivery} onDelivery={setDelivery} />
                ) : (
                  <PageLoader />
                )}
              </>
            )}
          </section>

          <aside className="card summary" aria-label="Booking summary">
            <div className="summary-movie">
              <Poster url={show.posterUrl} title={show.movieTitle} size="xs" />
              <div>
                <h2>{show.movieTitle}</h2>
                <p className="muted small">
                  {formatLongDay(show.startsAt)}
                  <br />
                  {formatTime(show.startsAt)} · Screen 1
                </p>
              </div>
            </div>
            <div className="summary-body">
              <div>
                <span className="label">Seats</span>
                {chosen.length === 0 ? (
                  <p className="muted small" style={{ marginTop: 4 }}>
                    No seats selected yet
                  </p>
                ) : (
                  <div className="seat-tags" style={{ marginTop: 6 }}>
                    {chosen.map((l) => (
                      <span key={l} className="seat-tag">
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <ul className="summary-lines">
                <li>
                  <span>
                    Tickets <span className="sub">({chosen.length} × {formatMoney(show.pricePaise)})</span>
                  </span>
                  <span>{formatMoney(ticketsTotal)}</span>
                </li>
                {snackLines.map((l) => (
                  <li key={l.snackId}>
                    <span>
                      {l.snack.name} <span className="sub">× {l.quantity}</span>
                    </span>
                    <span>{formatMoney(l.snack.pricePaise * l.quantity)}</span>
                  </li>
                ))}
                <li className="sub">
                  <span>Convenience fee</span>
                  <span>Free</span>
                </li>
              </ul>
              <div className="summary-total">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>

              {hold && <Countdown remainingMs={remaining} />}

              {step === 'seats' ? (
                <button
                  className="btn btn-primary btn-block btn-lg"
                  disabled={chosen.length === 0 || holdMutation.isPending || show.started}
                  onClick={() => holdMutation.mutate(chosen)}
                >
                  {holdMutation.isPending ? 'Holding seats…' : chosen.length ? `Continue · ${formatMoney(ticketsTotal)}` : 'Continue'}
                </button>
              ) : (
                <>
                  <button className="btn btn-primary btn-block btn-lg" onClick={() => setPayment('choose')}>
                    Pay {formatMoney(total)}
                  </button>
                  <button className="btn btn-ghost btn-block" disabled={releaseMutation.isPending} onClick={() => releaseMutation.mutate()}>
                    ← Change seats
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {payment !== 'closed' && hold && (
        <Modal title={payment === 'failed' ? 'Payment failed' : 'Complete payment'} onClose={() => !bookMutation.isPending && setPayment('closed')}>
          {payment === 'choose' ? (
            <div className="gateway">
              <span className="gateway-brand">🔒 Demo payment gateway</span>
              <p className="muted small">This is a simulated gateway. No money is charged. Choose the outcome to test.</p>
              <p className="pay-amount">{formatMoney(total)}</p>
              <p className="small muted center">
                {show.movieTitle} · {hold.seats.join(', ')}
                {snackLines.length > 0 && ` · ${snackLines.length} snack item${snackLines.length > 1 ? 's' : ''}`}
              </p>
              <div className="modal-actions">
                <button className="btn btn-danger-ghost" disabled={bookMutation.isPending} onClick={() => setPayment('failed')}>
                  Payment failure
                </button>
                <button className="btn btn-success" disabled={bookMutation.isPending} onClick={() => bookMutation.mutate(hold.seats)}>
                  {bookMutation.isPending ? 'Confirming…' : 'Payment success'}
                </button>
              </div>
            </div>
          ) : (
            <div className="gateway">
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
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

// Other show times of the same movie that day. Locked while seats are held, so a hold is never
// left behind on another show by accident.
function TimeSwitch({ shows, currentId, locked }: { shows: Show[]; currentId: number; locked: boolean }) {
  return (
    <nav className="time-switch" aria-label="Other show times today">
      {shows.map((s) =>
        s.id === currentId ? (
          <span key={s.id} className="current" aria-current="page">
            {formatTime(s.startsAt)}
          </span>
        ) : locked ? (
          <span key={s.id} className="locked" title="Change seats first to switch show time">
            {formatTime(s.startsAt)}
          </span>
        ) : (
          <Link key={s.id} to={`/shows/${s.id}`}>
            {formatTime(s.startsAt)}
          </Link>
        ),
      )}
    </nav>
  )
}
