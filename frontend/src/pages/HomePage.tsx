import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { queries } from '../api/queries'
import type { Movie, Rating } from '../api/types'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, PageLoader, Poster } from '../components/ui'
import { dateKey, formatDay, formatDuration, formatTime, todayKey } from '../lib/format'
import { heroGlow } from '../lib/hue'

function nextShowText(iso: string | null | undefined) {
  if (!iso) return null
  return `${dateKey(iso) === todayKey() ? 'Today' : formatDay(iso)}, ${formatTime(iso)}`
}

// "The Last Monsoon" -> ["The Last", "Monsoon"]: first line blue, second magenta.
function splitTitle(title: string): [string, string] {
  const words = title.split(' ')
  if (words.length === 1) return ['', title]
  const cut = Math.ceil(words.length / 2)
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')]
}

const pad = (n: number) => String(n).padStart(2, '0')

function Hero({ movies }: { movies: Movie[] }) {
  const [index, setIndex] = useState(0)
  const movie = movies[index]
  const [first, second] = splitTitle(movie.title)
  const go = (step: number) => setIndex((i) => (i + step + movies.length) % movies.length)

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Featured movies">
      <div className="band-glow" style={heroGlow(movie.title)} />
      {movies.length > 1 && (
        <div className="hero-pager">
          <button onClick={() => go(-1)} aria-label="Previous movie">
            <Icon name="arrowLeft" size={16} />
          </button>
          <span aria-live="polite">
            {pad(index + 1)} / {pad(movies.length)}
          </span>
          <button onClick={() => go(1)} aria-label="Next movie">
            <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
      <div>
        <span className="kicker">Now showing at Yozigo</span>
        <h1 className="hero-title">
          {first && <span className="line">{first}</span>}
          <span className="line">{second}</span>
        </h1>
        <p className="hero-sub">
          {movie.genre || movie.language} · {movie.language} · {formatDuration(movie.durationMin)}
          <br />
          {movie.nextShowAt ? (
            <>
              Next show <em>{nextShowText(movie.nextShowAt)}</em>
            </>
          ) : (
            'No upcoming shows'
          )}
        </p>
        <p className="lead">{movie.description}</p>
        <Link to={`/movies/${movie.id}`} className="cta">
          <span className="cta-circle">
            <Icon name="arrow" />
          </span>
          Book tickets
        </Link>
      </div>
      <Poster url={movie.posterUrl} title={movie.title} size="lg" />
    </section>
  )
}

function UpNext({ movies }: { movies: Movie[] }) {
  return (
    <aside className="card upnext" aria-label="Up next">
      <p className="card-title">
        <span>Up next</span>
        <span className="t-pink">Screen 1</span>
      </p>
      {movies.map((m) => (
        <Link key={m.id} to={`/movies/${m.id}`} className="upnext-item">
          <Poster url={m.posterUrl} title={m.title} size="xs" />
          <span>
            <strong>{m.title}</strong>
            <span className="upnext-time">{nextShowText(m.nextShowAt)}</span>
          </span>
          <span className="upnext-go">
            <Icon name="arrow" size={18} />
          </span>
        </Link>
      ))}
    </aside>
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

  // The API lists movies with the soonest show first.
  const playing = movies.filter((m) => m.nextShowAt)

  return (
    <div className="container main">
      {playing.length > 0 && !q && (
        <div className="home-top" style={{ marginTop: 0 }}>
          <Hero movies={playing.slice(0, 4)} />
          <UpNext movies={playing.slice(0, 6)} />
        </div>
      )}

      <section className={playing.length > 0 && !q ? 'section' : undefined}>
        <div className="section-head">
          <div>
            <h2>{q ? `Results for “${params.get('q')}”` : 'In cinemas'}</h2>
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
          <div className="filters" style={{ margin: 0 }}>
            <div className="chips" role="group" aria-label="Language">
              <button className="chip" aria-pressed={language === null} onClick={() => setLanguage(null)}>
                All
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
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No movies match">Try another language, certificate or search.</EmptyState>
        ) : (
          <ul className="movie-grid">
            {visible.map((m, i) => (
              <li key={m.id}>
                <Link to={`/movies/${m.id}`} className="movie-card">
                  <div className="movie-card-poster">
                    <Poster url={m.posterUrl} title={m.title} />
                    <span className="badge badge-dark">{m.rating}</span>
                    <span className="movie-card-index" aria-hidden>
                      {pad(i + 1)}
                    </span>
                  </div>
                  <div>
                    <h3 className="movie-card-title">{m.title}</h3>
                    <p className="movie-card-genre">
                      {m.language} · {formatDuration(m.durationMin)}
                    </p>
                  </div>
                  <p className={`next-show${m.nextShowAt ? '' : ' none'}`}>
                    {m.nextShowAt ? nextShowText(m.nextShowAt) : 'No shows yet'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section features" aria-label="Why book with us">
        <div className="feature">
          <span className="feature-no">01</span>
          <h3>Snacks to your seat</h3>
          <p className="muted small">Order popcorn and drinks with your tickets. We bring them when the show starts or at the interval.</p>
        </div>
        <div className="feature">
          <span className="feature-no">02</span>
          <h3>A seat map that's always current</h3>
          <p className="muted small">You see seats being taken as it happens, and yours are held for 5 minutes while you pay.</p>
        </div>
        <div className="feature">
          <span className="feature-no">03</span>
          <h3>Free cancellation</h3>
          <p className="muted small">Plans changed? Cancel up to 2 hours before the show and the seats go straight back on sale.</p>
        </div>
      </section>
    </div>
  )
}
