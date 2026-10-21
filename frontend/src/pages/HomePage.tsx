import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { queries } from '../api/queries'
import type { Movie, Rating } from '../api/types'
import { EmptyState, ErrorState, PageLoader, Poster, RatingBadge } from '../components/ui'
import { dateKey, formatDuration, formatTime, todayKey, formatDay } from '../lib/format'
import { heroGlow } from '../lib/hue'

function nextShowText(iso: string | null | undefined) {
  if (!iso) return null
  return `${dateKey(iso) === todayKey() ? 'Today' : formatDay(iso)}, ${formatTime(iso)}`
}

// Rotating banner of the movies playing soonest.
function Featured({ movies }: { movies: Movie[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || movies.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % movies.length), 7000)
    return () => clearInterval(id)
  }, [paused, movies.length])

  const movie = movies[index % movies.length]
  return (
    <section className="band" aria-label="Featured" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="band-glow" style={heroGlow(movie.title)} />
      <div className="container featured">
        <div>
          <span className="featured-kicker">Now showing</span>
          <h1>{movie.title}</h1>
          <p className="meta">
            <RatingBadge rating={movie.rating} />
            <span>{movie.genre}</span>
            <span className="dot">{movie.language}</span>
            <span className="dot">{formatDuration(movie.durationMin)}</span>
          </p>
          <p className="lead">{movie.description}</p>
          <div className="row">
            <Link to={`/movies/${movie.id}`} className="btn btn-primary btn-lg">
              Book tickets
            </Link>
            {movie.nextShowAt && <span className="muted small">&nbsp; Next show: {nextShowText(movie.nextShowAt)}</span>}
          </div>
          {movies.length > 1 && (
            <div className="featured-dots" role="group" aria-label="Choose featured movie">
              {movies.map((m, i) => (
                <button key={m.id} aria-label={m.title} aria-current={i === index % movies.length} onClick={() => setIndex(i)} />
              ))}
            </div>
          )}
        </div>
        <Poster url={movie.posterUrl} title={movie.title} size="lg" />
      </div>
    </section>
  )
}

const RATINGS: Rating[] = ['U', 'UA', 'A']

export function HomePage() {
  const { data: movies, isPending, error, refetch } = useQuery(queries.movies())
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').toLowerCase()
  const [language, setLanguage] = useState<string | null>(null)
  const [rating, setRating] = useState<Rating | null>(null)

  const languages = useMemo(() => [...new Set((movies ?? []).map((m) => m.language))].sort(), [movies])
  const visible = useMemo(
    () =>
      (movies ?? []).filter(
        (m) =>
          (!language || m.language === language) &&
          (!rating || m.rating === rating) &&
          (!q || `${m.title} ${m.genre} ${m.language}`.toLowerCase().includes(q)),
      ),
    [movies, language, rating, q],
  )

  if (isPending) return <PageLoader />
  if (error) return <div className="container main"><ErrorState error={error} onRetry={refetch} /></div>

  const featured = movies.filter((m) => m.nextShowAt).slice(0, 4)

  return (
    <>
      {featured.length > 0 && !q && <Featured movies={featured} />}

      <div className="container main">
        <div className="section-head">
          <div>
            <h2>{q ? `Results for “${params.get('q')}”` : 'Movies in cinemas'}</h2>
            <p className="muted small">
              {visible.length} {visible.length === 1 ? 'movie' : 'movies'}
              {q && (
                <>
                  {' · '}
                  <button className="btn-link" onClick={() => setParams({})}>
                    Clear search
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="filters">
          <div className="chips" role="group" aria-label="Language">
            <button className="chip" aria-pressed={language === null} onClick={() => setLanguage(null)}>
              All languages
            </button>
            {languages.map((l) => (
              <button key={l} className="chip" aria-pressed={language === l} onClick={() => setLanguage(language === l ? null : l)}>
                {l}
              </button>
            ))}
          </div>
          <div className="chips" role="group" aria-label="Certificate">
            {RATINGS.map((r) => (
              <button key={r} className="chip" aria-pressed={rating === r} onClick={() => setRating(rating === r ? null : r)}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No movies match">Try another language, certificate or search.</EmptyState>
        ) : (
          <ul className="movie-grid">
            {visible.map((m) => (
              <li key={m.id}>
                <Link to={`/movies/${m.id}`} className="movie-card">
                  <div className="movie-card-poster">
                    <Poster url={m.posterUrl} title={m.title} />
                    <span className="badge badge-dark">{m.rating}</span>
                  </div>
                  <div>
                    <h3 className="movie-card-title">{m.title}</h3>
                    <p className="movie-card-genre">{m.genre || m.language}</p>
                    <p className="meta xsmall">
                      <span>{m.language}</span>
                      <span className="dot">{formatDuration(m.durationMin)}</span>
                    </p>
                  </div>
                  <p className={`next-show${m.nextShowAt ? '' : ' none'}`}>
                    {m.nextShowAt ? `Next: ${nextShowText(m.nextShowAt)}` : 'No upcoming shows'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="section card features" aria-label="Why book with us">
          <div className="feature">
            <span className="feature-icon" aria-hidden>🍿</span>
            <div>
              <h3>Snacks to your seat</h3>
              <p className="muted small">Pre-order popcorn and drinks while booking. We bring them at the start or at the interval.</p>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon" aria-hidden>⚡</span>
            <div>
              <h3>Live seat map</h3>
              <p className="muted small">See seats being taken in real time. Your seats are held for 5 minutes while you pay.</p>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon" aria-hidden>↩</span>
            <div>
              <h3>Free cancellation</h3>
              <p className="muted small">Plans changed? Cancel up to 2 hours before the show and the seats go back on sale.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
