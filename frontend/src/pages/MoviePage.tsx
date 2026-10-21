import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { queries } from '../api/queries'
import type { Show } from '../api/types'
import { EmptyState, ErrorState, PageLoader, Poster, RatingBadge } from '../components/ui'
import { dateKey, formatDuration, formatMoney, formatTime, todayKey } from '../lib/format'
import { heroGlow } from '../lib/hue'
import { AVAILABILITY_TEXT, availability } from '../lib/seats'
import { CINEMA_TIME_ZONE } from '../lib/format'

const DAYS_SHOWN = 7
const pillFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: CINEMA_TIME_ZONE, ...opts })
const dowFmt = pillFmt({ weekday: 'short' })
const domFmt = pillFmt({ day: 'numeric' })
const monFmt = pillFmt({ month: 'short' })

// The next 7 days in the cinema's time zone, each with its shows.
function buildDays(shows: Show[]) {
  const byDay = new Map<string, Show[]>()
  for (const s of shows) byDay.set(dateKey(s.startsAt), [...(byDay.get(dateKey(s.startsAt)) ?? []), s])
  return Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = new Date(Date.now() + i * 86_400_000)
    const key = dateKey(date.toISOString())
    return { key, date, shows: byDay.get(key) ?? [] }
  })
}

export function MoviePage() {
  const id = Number(useParams().id)
  const { data, isPending, error, refetch } = useQuery(queries.movie(id))
  const days = useMemo(() => buildDays(data?.shows ?? []), [data])
  const [picked, setPicked] = useState<string | null>(null)

  if (isPending) return <PageLoader />
  if (error) return <div className="container main"><ErrorState error={error} onRetry={refetch} /></div>

  const { movie, shows } = data
  // Default to the first day that has shows.
  const selectedKey = picked ?? days.find((d) => d.shows.length)?.key ?? days[0].key
  const selected = days.find((d) => d.key === selectedKey)!
  const prices = shows.map((s) => s.pricePaise)

  return (
    <>
      <section className="band">
        <div className="band-glow" style={heroGlow(movie.title)} />
        <div className="container movie-hero">
          <Poster url={movie.posterUrl} title={movie.title} size="lg" />
          <div>
            <Link to="/" className="back-link" style={{ color: 'var(--on-ink-muted)' }}>
              ← All movies
            </Link>
            <h1>{movie.title}</h1>
            <div className="info-pills">
              <span className="info-pill">
                <RatingBadge rating={movie.rating} /> Certificate
              </span>
              <span className="info-pill">{movie.language}</span>
              <span className="info-pill">{formatDuration(movie.durationMin)}</span>
              {movie.genre && <span className="info-pill">{movie.genre}</span>}
            </div>
            {movie.description && <p className="lead">{movie.description}</p>}
            {shows.length > 0 && (
              <a href="#showtimes" className="btn btn-primary btn-lg">
                Book tickets
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="container main">
        <div className="showtimes-layout section" id="showtimes" style={{ marginTop: 0 }}>
          <section className="card" aria-labelledby="showtimes-title">
            <div className="panel-head" style={{ marginBottom: 'var(--s4)' }}>
              <h2 id="showtimes-title">Show times</h2>
              <span className="muted small">Screen 1 · times in IST</span>
            </div>
            <div className="date-strip" role="group" aria-label="Choose a date">
              {days.map((d) => (
                <button
                  key={d.key}
                  className="date-pill"
                  aria-pressed={d.key === selectedKey}
                  disabled={d.shows.length === 0}
                  onClick={() => setPicked(d.key)}
                  aria-label={`${d.key === todayKey() ? 'Today' : dowFmt.format(d.date)} ${domFmt.format(d.date)} ${monFmt.format(d.date)}, ${d.shows.length} shows`}
                >
                  <span className="dow">{d.key === todayKey() ? 'Today' : dowFmt.format(d.date)}</span>
                  <span className="dom">{domFmt.format(d.date)}</span>
                  <span className="mon">{monFmt.format(d.date)}</span>
                </button>
              ))}
            </div>

            {selected.shows.length === 0 ? (
              <EmptyState title="No shows on this day">Pick another date above.</EmptyState>
            ) : (
              <>
                <div className="show-grid">
                  {selected.shows.map((s) => {
                    const level = availability(s.availableSeats)
                    return (
                      <Link key={s.id} to={`/shows/${s.id}`} className={`show-chip ${level}`} aria-label={`${formatTime(s.startsAt)}, ${formatMoney(s.pricePaise)}, ${s.availableSeats} seats left`}>
                        <span className="show-chip-time">{formatTime(s.startsAt)}</span>
                        <span className="show-chip-price">{formatMoney(s.pricePaise)}</span>
                        <span className="show-chip-seats">
                          {level === 'soldout' ? 'Sold out' : `${s.availableSeats} left · ${AVAILABILITY_TEXT[level]}`}
                        </span>
                      </Link>
                    )
                  })}
                </div>
                <div className="legend-inline" aria-hidden>
                  <span>Available</span>
                  <span className="fast">Filling fast</span>
                  <span className="full">Almost full</span>
                </div>
              </>
            )}
          </section>

          <aside className="card" aria-label="Before you book">
            <h3 className="card-title">Before you book</h3>
            <ul className="info-list">
              <li>
                <span className="ico" aria-hidden>🎟</span>
                <span>
                  <strong>{prices.length ? `${formatMoney(Math.min(...prices))} – ${formatMoney(Math.max(...prices))}` : 'No shows yet'}</strong>
                  <br />
                  <span className="muted">Ticket price per seat, no convenience fee</span>
                </span>
              </li>
              <li>
                <span className="ico" aria-hidden>🍿</span>
                <span>
                  <strong>Snacks to your seat</strong>
                  <br />
                  <span className="muted">Add food and drinks at checkout</span>
                </span>
              </li>
              <li>
                <span className="ico" aria-hidden>⏱</span>
                <span>
                  <strong>5-minute seat hold</strong>
                  <br />
                  <span className="muted">Up to 6 seats per booking</span>
                </span>
              </li>
              <li>
                <span className="ico" aria-hidden>↩</span>
                <span>
                  <strong>Free cancellation</strong>
                  <br />
                  <span className="muted">Up to 2 hours before the show</span>
                </span>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </>
  )
}
