import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { queries } from '../api/queries'
import type { Booking } from '../api/types'
import { EmptyState, ErrorState, PageLoader, Poster, StatusBadge } from '../components/ui'
import { formatLongDay, formatMoney, formatTime, shortId } from '../lib/format'

function BookingCard({ b }: { b: Booking }) {
  return (
    <li>
      <Link to={`/bookings/${b.id}`} className={`booking-card${b.status === 'cancelled' ? ' cancelled' : ''}`}>
        <Poster url={b.posterUrl} title={b.movieTitle} size="sm" />
        <div>
          <div className="booking-card-top">
            <div>
              <p className="booking-card-title">{b.movieTitle}</p>
              <p className="muted small">
                {formatLongDay(b.startsAt)} · {formatTime(b.startsAt)}
              </p>
            </div>
            <StatusBadge status={b.status} upcoming={b.upcoming} />
          </div>
          <div className="booking-card-facts">
            <div>
              <span className="label">Seats</span>
              {b.seats.join(', ')}
            </div>
            <div>
              <span className="label">Amount</span>
              {formatMoney(b.amountPaise)}
              {b.snacks.length > 0 && <span className="muted xsmall"> · incl. snacks</span>}
            </div>
            <div>
              <span className="label">Booking ID</span>
              <span className="mono">{shortId(b.id)}</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  )
}

export function MyBookingsPage() {
  const { data: bookings, isPending, error, refetch } = useQuery(queries.bookings())
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  if (isPending) return <PageLoader />
  if (error) return <div className="container main"><ErrorState error={error} onRetry={refetch} /></div>

  // The API already orders upcoming (soonest first) before past (latest first).
  const upcoming = bookings.filter((b) => b.upcoming)
  const past = bookings.filter((b) => !b.upcoming)
  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div className="container main">
      <div className="section-head">
        <div>
          <h1>My bookings</h1>
          <p className="muted small">Tap a booking to see the e-ticket, snacks and cancellation options.</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Bookings">
        <button role="tab" className="tab" aria-selected={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
          Upcoming <span className="count">{upcoming.length}</span>
        </button>
        <button role="tab" className="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>
          Past <span className="count">{past.length}</span>
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState title={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}>
          <Link to="/" className="btn btn-primary">
            Browse movies
          </Link>
        </EmptyState>
      ) : (
        <ul className="booking-grid" role="tabpanel">
          {list.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </ul>
      )}
    </div>
  )
}
