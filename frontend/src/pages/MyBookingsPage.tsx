import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { queries } from '../api/queries'
import type { Booking } from '../api/types'
import { EmptyState, ErrorState, PageLoader, StatusBadge } from '../components/ui'
import { formatLongDay, formatMoney, formatTime, shortId } from '../lib/format'

function BookingRow({ b }: { b: Booking }) {
  return (
    <li>
      <Link to={`/bookings/${b.id}`} className={`booking-row${b.status === 'cancelled' ? ' booking-row-cancelled' : ''}`}>
        <div className="booking-row-main">
          <span className="booking-row-title">{b.movieTitle}</span>
          <span className="muted">
            {formatLongDay(b.startsAt)} · {formatTime(b.startsAt)}
          </span>
        </div>
        <div className="booking-row-cell">
          <span className="label">Seats</span>
          {b.seats.join(', ')}
        </div>
        <div className="booking-row-cell">
          <span className="label">Amount</span>
          {formatMoney(b.amountPaise)}
        </div>
        <div className="booking-row-cell">
          <span className="label">Booking ID</span>
          <span className="mono">{shortId(b.id)}</span>
        </div>
        <StatusBadge status={b.status} upcoming={b.upcoming} />
      </Link>
    </li>
  )
}

export function MyBookingsPage() {
  const { data: bookings, isPending, error, refetch } = useQuery(queries.bookings())
  if (isPending) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  // The API already orders upcoming (soonest first) before past (latest first).
  const upcoming = bookings.filter((b) => b.upcoming)
  const past = bookings.filter((b) => !b.upcoming)

  return (
    <>
      <div className="page-head">
        <h1>My bookings</h1>
      </div>
      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet">
          <Link to="/" className="btn btn-primary">
            Browse movies
          </Link>
        </EmptyState>
      ) : (
        <>
          <h2 className="section-title">Upcoming</h2>
          {upcoming.length ? <ul className="booking-list">{upcoming.map((b) => <BookingRow key={b.id} b={b} />)}</ul> : <p className="muted">No upcoming bookings.</p>}
          {past.length > 0 && (
            <>
              <h2 className="section-title">Past</h2>
              <ul className="booking-list">{past.map((b) => <BookingRow key={b.id} b={b} />)}</ul>
            </>
          )}
        </>
      )}
    </>
  )
}
