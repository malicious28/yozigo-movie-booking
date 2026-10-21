import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { queries } from '../../api/queries'
import type { SeatState } from '../../api/types'
import { SeatMap } from '../../components/SeatMap'
import { EmptyState, ErrorState, PageLoader, StatusBadge } from '../../components/ui'
import { formatDateTime, formatLongDay, formatMoney, formatTime, shortId } from '../../lib/format'

// One show from the cinema's side: occupancy, money collected, the live seat map and every booking.
export default function AdminShowPage() {
  const id = Number(useParams().id)
  const show = useQuery(queries.show(id))
  const seats = useQuery(queries.seats(id))
  const bookings = useQuery(queries.adminShowBookings(id))

  const states = useMemo(() => {
    const map: Record<string, SeatState> = {}
    for (const s of seats.data?.seats ?? []) map[s.label] = s.state
    return map
  }, [seats.data])

  const err = show.error ?? seats.error ?? bookings.error
  if (err) return <ErrorState error={err} />
  if (!show.data || !seats.data || !bookings.data) return <PageLoader />

  const booked = Object.values(states).filter((s) => s === 'booked').length
  const total = Object.keys(states).length
  const revenue = bookings.data.filter((b) => b.status === 'confirmed').reduce((sum, b) => sum + b.amountPaise, 0)

  return (
    <>
      <Link to="/admin" className="back-link">
        ← All shows
      </Link>
      <h2>
        {show.data.movieTitle} · {formatLongDay(show.data.startsAt)}, {formatTime(show.data.startsAt)}
      </h2>
      <div className="stats">
        <div className="stat card">
          <span className="label">Seats booked</span>
          <strong>
            {booked} / {total}
          </strong>
        </div>
        <div className="stat card">
          <span className="label">Full</span>
          <strong>{total ? Math.round((booked / total) * 100) : 0}%</strong>
        </div>
        <div className="stat card">
          <span className="label">Collected</span>
          <strong>{formatMoney(revenue)}</strong>
        </div>
      </div>

      <div className="admin-show-layout">
        <section className="card seatmap-card" aria-label="Seat map">
          <SeatMap states={states} />
        </section>
        <section className="card">
          <h3 className="card-title">Bookings</h3>
          {bookings.data.length === 0 ? (
            <EmptyState title="No bookings yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Seats</th>
                    <th>Booked at</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.data.map((b) => (
                    <tr key={b.id}>
                      <td className="mono" title={b.id}>
                        {shortId(b.id)}
                      </td>
                      <td>
                        {b.customerName}
                        <br />
                        <span className="small muted">{b.customerEmail}</span>
                      </td>
                      <td>{b.seats.join(', ')}</td>
                      <td>{formatDateTime(b.createdAt)}</td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
