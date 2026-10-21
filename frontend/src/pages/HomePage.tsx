import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { queries } from '../api/queries'
import { EmptyState, ErrorState, PageLoader, Poster, RatingBadge } from '../components/ui'
import { formatDuration } from '../lib/format'

export function HomePage() {
  const { data: movies, isPending, error, refetch } = useQuery(queries.movies())

  if (isPending) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <>
      <div className="page-head">
        <h1>Now showing</h1>
        <p className="muted">Pick a movie to see show times and book seats.</p>
      </div>
      {movies.length === 0 ? (
        <EmptyState title="No movies yet">Check back soon.</EmptyState>
      ) : (
        <ul className="movie-grid">
          {movies.map((m) => (
            <li key={m.id}>
              <Link to={`/movies/${m.id}`} className="movie-card">
                <Poster url={m.posterUrl} title={m.title} />
                <div className="movie-card-body">
                  <h2 className="movie-card-title">{m.title}</h2>
                  <p className="meta">
                    <RatingBadge rating={m.rating} />
                    <span>{m.language}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDuration(m.durationMin)}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
