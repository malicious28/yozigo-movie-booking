import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../../api/client'
import { queries } from '../../api/queries'
import type { Movie, Rating } from '../../api/types'
import { Alert, EmptyState, ErrorState, PageLoader, Poster, RatingBadge } from '../../components/ui'
import { formatDuration } from '../../lib/format'

type MovieForm = { title: string; description: string; posterUrl: string; language: string; durationMin: string; rating: Rating }
const EMPTY: MovieForm = { title: '', description: '', posterUrl: '', language: '', durationMin: '120', rating: 'UA' }
const toForm = (m: Movie): MovieForm => ({ ...m, posterUrl: m.posterUrl ?? '', durationMin: String(m.durationMin) })

function MovieEditor({ movie, onDone }: { movie: Movie | null; onDone: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<MovieForm>(movie ? toForm(movie) : EMPTY)
  const set = (k: keyof MovieForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, durationMin: Number(form.durationMin) }
      return movie ? api.put(`/admin/movies/${movie.id}`, body) : api.post('/admin/movies', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movies'] })
      qc.invalidateQueries({ queryKey: ['admin'] })
      onDone()
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form className="card form" onSubmit={submit} aria-label={movie ? `Edit ${movie.title}` : 'Add a movie'}>
      <h2 className="card-title">{movie ? `Edit “${movie.title}”` : 'Add a movie'}</h2>
      {save.isError && <Alert kind="error">{errorMessage(save.error)}</Alert>}
      <div className="form-grid">
        <label className="field span-2">
          <span>Title</span>
          <input required maxLength={200} value={form.title} onChange={set('title')} />
        </label>
        <label className="field">
          <span>Language</span>
          <input required maxLength={50} value={form.language} onChange={set('language')} />
        </label>
        <label className="field">
          <span>Duration (minutes)</span>
          <input type="number" required min={1} max={600} value={form.durationMin} onChange={set('durationMin')} />
        </label>
        <label className="field">
          <span>Rating</span>
          <select value={form.rating} onChange={set('rating')}>
            <option value="U">U</option>
            <option value="UA">UA</option>
            <option value="A">A</option>
          </select>
        </label>
        <label className="field">
          <span>Poster URL (optional)</span>
          <input type="url" placeholder="https://…" maxLength={1000} value={form.posterUrl} onChange={set('posterUrl')} />
        </label>
        <label className="field span-2">
          <span>Description</span>
          <textarea rows={3} maxLength={2000} value={form.description} onChange={set('description')} />
        </label>
      </div>
      {movie && <p className="small muted">Changing the duration also moves the end time of this movie's upcoming shows.</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : movie ? 'Save changes' : 'Add movie'}
        </button>
      </div>
    </form>
  )
}

export default function AdminMoviesPage() {
  const qc = useQueryClient()
  const { data: movies, isPending, error, refetch } = useQuery(queries.movies())
  // undefined = editor closed, null = adding a new movie
  const [editing, setEditing] = useState<Movie | null | undefined>(undefined)

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/movies/${id}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['movies'] })
      qc.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  if (isPending) return <PageLoader />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <>
      {editing === undefined ? (
        <button className="btn btn-primary" onClick={() => setEditing(null)}>
          + Add movie
        </button>
      ) : (
        <MovieEditor key={editing?.id ?? 'new'} movie={editing} onDone={() => setEditing(undefined)} />
      )}
      {remove.isError && <Alert kind="error">{errorMessage(remove.error)}</Alert>}

      {movies.length === 0 ? (
        <EmptyState title="No movies yet" />
      ) : (
        <ul className="admin-movie-list">
          {movies.map((m) => (
            <li key={m.id} className="card admin-movie">
              <Poster url={m.posterUrl} title={m.title} size="sm" />
              <div className="admin-movie-body">
                <strong>{m.title}</strong>
                <p className="meta">
                  <RatingBadge rating={m.rating} />
                  <span>{m.language}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDuration(m.durationMin)}</span>
                </p>
              </div>
              <div className="actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(m)}>
                  Edit
                </button>
                <button
                  className="btn btn-danger-ghost btn-sm"
                  disabled={remove.isPending}
                  onClick={() => window.confirm(`Delete "${m.title}" and all of its shows?`) && remove.mutate(m.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
