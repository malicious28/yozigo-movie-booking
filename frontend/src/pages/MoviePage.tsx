import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { queries } from '../api/queries'
import type { Show } from '../api/types'
import { EmptyState, ErrorState, PageLoader, Poster, RatingBadge } from '../components/ui'
import { dateKey, formatDay, formatDuration, formatMoney, formatTime, todayKey } from '../lib/format'

function groupByDate(shows: Show[]) {
  const groups = new Map<string, Show[]>()
  for (const s of shows) {
    const key = dateKey(s.startsAt)
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  return [...groups.entries()]
}

export function MoviePage() {
  const id = Number(useParams().id)
  const { data, isPending, error, refetch } = useQuery(queries.movie(id))
  const days = useMemo(() => groupByDate(data?.shows ?? []), [data])

  if (isPending) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const { movie } = data
  const today = todayKey()

  return (
    <>
      <Link to="/" className="back-link">
        ← All movies
      </Link>
      <section className="movie-hero">
        <Poster url={movie.posterUrl} title={movie.title} size="lg" />
        <div>
          <h1>{movie.title}</h1>
          <p className="meta">
            <RatingBadge rating={movie.rating} />
            <span>{movie.language}</span>
            <span aria-hidden>·</span>
            <span>{formatDuration(movie.durationMin)}</span>
          </p>
          {movie.description && <p className="lead">{movie.description}</p>}
        </div>
      </section>

      <h2 className="section-title">Show times</h2>
      {days.length === 0 ? (
        <EmptyState title="No upcoming shows">New shows are added regularly.</EmptyState>
      ) : (
        days.map(([key, shows]) => (
          <section key={key} className="show-day" aria-labelledby={`day-${key}`}>
            <h3 id={`day-${key}`} className="show-day-title">
              {key === today ? 'Today' : formatDay(shows[0].startsAt)}
            </h3>
            <ul className="show-list">
              {shows.map((s) => {
                const soldOut = s.availableSeats === 0
                return (
                  <li key={s.id}>
                    <Link to={`/shows/${s.id}`} className={`show-chip${soldOut ? ' show-chip-disabled' : ''}`} aria-disabled={soldOut}>
                      <span className="show-chip-time">{formatTime(s.startsAt)}</span>
                      <span className="show-chip-price">{formatMoney(s.pricePaise)}</span>
                      <span className={`show-chip-seats${s.availableSeats <= 10 ? ' low' : ''}`}>
                        {soldOut ? 'Sold out' : `${s.availableSeats} seats left`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
