import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import { queries } from '../api/queries'
import type { Booking } from '../api/types'
import { Icon } from '../components/Icon'
import { Alert, ErrorState, Modal, PageLoader, Poster, StatusBadge } from '../components/ui'
import { formatDateTime, formatLongDay, formatMoney, formatTime, shortId } from '../lib/format'

// QR code of the booking ID, generated in the browser. The library is loaded only on this page.
function useQrCode(text: string) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((QR) => QR.toDataURL(text, { margin: 1, width: 300, errorCorrectionLevel: 'M' }))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [text])
  return src
}

// The e-ticket: booking confirmation and details. Also the place to cancel (flow 8).
export function BookingPage() {
  const id = useParams().id!
  const justBooked = (useLocation().state as { justBooked?: boolean } | null)?.justBooked
  const qc = useQueryClient()
  const { data: booking, isPending, error, refetch } = useQuery(queries.booking(id))
  const [confirming, setConfirming] = useState(false)
  const qr = useQrCode(id)

  const cancel = useMutation({
    mutationFn: () => api.post<{ booking: Booking }>(`/bookings/${id}/cancel`),
    onSuccess: ({ booking }) => {
      qc.setQueryData(queries.booking(id).queryKey, booking)
      qc.invalidateQueries({ queryKey: queries.bookings().queryKey, exact: true })
      qc.invalidateQueries({ queryKey: ['movies'] })
      setConfirming(false)
    },
  })

  if (isPending) return <PageLoader />
  if (error) return <div className="container main"><ErrorState error={error} onRetry={refetch} /></div>

  const snacksTotal = booking.snacks.reduce((sum, s) => sum + s.unitPricePaise * s.quantity, 0)

  return (
    <div className="container main">
      <div className="ticket-wrap">
        <Link to="/bookings" className="back-link">
          <Icon name="arrowLeft" size={14} /> My bookings
        </Link>
        {justBooked && booking.status === 'confirmed' && (
          <Alert kind="success">
            <span>
              <strong>Booking confirmed!</strong> Show this QR code at the entrance.
            </span>
          </Alert>
        )}
        {cancel.isSuccess && <Alert kind="info">Your booking was cancelled and the seats were released.</Alert>}

        <article className={`ticket${booking.status === 'cancelled' ? ' ticket-cancelled' : ''}`}>
          <div className="ticket-main">
            <Poster url={booking.posterUrl} title={booking.movieTitle} />
            <div>
              <div className="ticket-head">
                <h1>{booking.movieTitle}</h1>
                <StatusBadge status={booking.status} upcoming={booking.upcoming} />
              </div>
              <p className="muted">{booking.language} · Screen 1</p>
              <dl className="ticket-grid">
                <div>
                  <dt>Date</dt>
                  <dd>{formatLongDay(booking.startsAt)}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatTime(booking.startsAt)}</dd>
                </div>
                <div>
                  <dt>Seats ({booking.seats.length})</dt>
                  <dd>{booking.seats.join(', ')}</dd>
                </div>
                <div>
                  <dt>Amount paid</dt>
                  <dd>{formatMoney(booking.amountPaise)}</dd>
                </div>
                <div>
                  <dt>Booked on</dt>
                  <dd>{formatDateTime(booking.createdAt)}</dd>
                </div>
                <div>
                  <dt>Snacks</dt>
                  <dd>{booking.snacks.length ? (booking.snackDelivery === 'interval' ? 'At interval' : 'At show start') : 'None'}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="ticket-stub">
            {qr ? <img className="qr" src={qr} alt={`QR code for booking ${shortId(booking.id)}`} /> : <div className="qr" />}
            <span className="label">Booking ID</span>
            <strong className="mono" style={{ fontSize: '1.2rem' }} title={booking.id}>
              {shortId(booking.id)}
            </strong>
          </div>
        </article>

        <div className="ticket-extra">
          <section className="card">
            <p className="card-title">Payment summary</p>
            <ul className="item-lines">
              <li>
                <span>Tickets ({booking.seats.length})</span>
                <span>{formatMoney(booking.ticketsPaise)}</span>
              </li>
              {booking.snacks.map((s) => (
                <li key={s.name}>
                  <span>
                    {s.icon} {s.name} × {s.quantity}
                  </span>
                  <span>{formatMoney(s.unitPricePaise * s.quantity)}</span>
                </li>
              ))}
              <li className="total">
                <span>Total</span>
                <span>{formatMoney(booking.ticketsPaise + snacksTotal)}</span>
              </li>
            </ul>
          </section>
          <section className="card">
            <p className="card-title">Good to know</p>
            <ul className="info-list small">
              <li>
                <span className="ico"><Icon name="clock" size={18} /></span>
                <span>Arrive 15 minutes early. Entry closes 10 minutes after the show starts.</span>
              </li>
              {booking.snacks.length > 0 && (
                <li>
                  <span className="ico"><Icon name="cup" size={18} /></span>
                  <span>
                    Your snacks will be brought to seat {booking.seats[0]} {booking.snackDelivery === 'interval' ? 'during the interval' : 'as the show starts'}.
                  </span>
                </li>
              )}
              <li>
                <span className="ico"><Icon name="undo" size={18} /></span>
                <span>
                  {booking.status === 'cancelled'
                    ? `Cancelled on ${formatDateTime(booking.cancelledAt!)}.`
                    : booking.cancellable
                      ? 'Free cancellation up to 2 hours before the show.'
                      : 'This booking can no longer be cancelled.'}
                </span>
              </li>
            </ul>
            {booking.cancellable && (
              <button className="btn btn-danger-ghost btn-sm" style={{ marginTop: 'var(--s4)' }} onClick={() => setConfirming(true)}>
                Cancel booking
              </button>
            )}
          </section>
        </div>
        <p className="xsmall muted mono center">Full booking ID: {booking.id}</p>
      </div>

      {confirming && (
        <Modal title="Cancel this booking?" onClose={() => !cancel.isPending && setConfirming(false)}>
          <p>
            Seats {booking.seats.join(', ')} for {booking.movieTitle} will be released and can be booked by others.
            {booking.snacks.length > 0 && ' Your snack order is cancelled too.'}
          </p>
          {cancel.isError && <div style={{ marginTop: 'var(--s3)' }}><Alert kind="error">{errorMessage(cancel.error)}</Alert></div>}
          <div className="modal-actions">
            <button className="btn btn-ghost" disabled={cancel.isPending} onClick={() => setConfirming(false)}>
              Keep booking
            </button>
            <button className="btn btn-danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
