import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import { queries } from '../api/queries'
import type { Booking } from '../api/types'
import { Alert, ErrorState, Modal, PageLoader, Poster, StatusBadge } from '../components/ui'
import { formatDateTime, formatLongDay, formatMoney, formatTime, shortId } from '../lib/format'

// Booking confirmation and details. Also the place to cancel (flow 8).
export function BookingPage() {
  const id = useParams().id!
  const justBooked = (useLocation().state as { justBooked?: boolean } | null)?.justBooked
  const qc = useQueryClient()
  const { data: booking, isPending, error, refetch } = useQuery(queries.booking(id))
  const [confirming, setConfirming] = useState(false)

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
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <>
      <Link to="/bookings" className="back-link">
        ← My bookings
      </Link>
      {justBooked && booking.status === 'confirmed' && (
        <Alert kind="success">
          <strong>Booking confirmed!</strong> Show your booking ID at the counter.
        </Alert>
      )}
      {cancel.isSuccess && <Alert kind="info">Your booking was cancelled and the seats were released.</Alert>}

      <article className="card ticket">
        <Poster url={booking.posterUrl} title={booking.movieTitle} size="md" />
        <div className="ticket-body">
          <div className="ticket-head">
            <h1>{booking.movieTitle}</h1>
            <StatusBadge status={booking.status} upcoming={booking.upcoming} />
          </div>
          <dl className="ticket-grid">
            <div>
              <dt>Booking ID</dt>
              <dd className="mono" title={booking.id}>
                {shortId(booking.id)}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatLongDay(booking.startsAt)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(booking.startsAt)}</dd>
            </div>
            <div>
              <dt>Seats</dt>
              <dd>{booking.seats.join(', ')}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{formatMoney(booking.amountPaise)}</dd>
            </div>
            <div>
              <dt>Booked on</dt>
              <dd>{formatDateTime(booking.createdAt)}</dd>
            </div>
          </dl>
          <p className="small muted mono">Full ID: {booking.id}</p>

          {booking.status === 'confirmed' && booking.upcoming && (
            <div className="ticket-actions">
              {booking.cancellable ? (
                <button className="btn btn-danger-ghost" onClick={() => setConfirming(true)}>
                  Cancel booking
                </button>
              ) : (
                <p className="small muted">Bookings can be cancelled up to 2 hours before the show.</p>
              )}
            </div>
          )}
        </div>
      </article>

      {confirming && (
        <Modal title="Cancel this booking?" onClose={() => !cancel.isPending && setConfirming(false)}>
          <p>
            Seats {booking.seats.join(', ')} for {booking.movieTitle} will be released and can be booked by others.
          </p>
          {cancel.isError && <Alert kind="error">{errorMessage(cancel.error)}</Alert>}
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
    </>
  )
}
