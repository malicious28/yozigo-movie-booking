import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import { queries } from '../../api/queries'
import type { AdminShow } from '../../api/types'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui'
import { dateKey, formatDateTime, formatMoney, todayKey } from '../../lib/format'

function AddShowForm() {
  const qc = useQueryClient()
  const movies = useQuery(queries.movies())
  const [form, setForm] = useState({ movieId: '', date: todayKey(), startTime: '18:00', price: '250' })

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/shows', {
        movieId: Number(form.movieId),
        date: form.date,
        startTime: form.startTime,
        pricePaise: Math.round(Number(form.price) * 100),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['movies'] })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <form className="card form form-inline" onSubmit={submit} aria-label="Add a show">
      <h2 className="card-title">Add a show</h2>
      {create.isError && <Alert kind="error">{errorMessage(create.error)}</Alert>}
      {create.isSuccess && <Alert kind="success">Show added.</Alert>}
      <div className="form-row">
        <label className="field">
          <span>Movie</span>
          <select required value={form.movieId} onChange={(e) => setForm({ ...form, movieId: e.target.value })}>
            <option value="">Choose a movie…</option>
            {movies.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.durationMin} min)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" required min={todayKey()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="field">
          <span>Start time</span>
          <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </label>
        <label className="field">
          <span>Price (₹)</span>
          <input type="number" required min={1} max={10000} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </label>
        <button className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add show'}
        </button>
      </div>
      <p className="small muted">Times are in the cinema's local time (IST). Shows on the screen cannot overlap.</p>
    </form>
  )
}

function ShowRow({ show, onDelete, deleting }: { show: AdminShow; onDelete: () => void; deleting: boolean }) {
  const pct = Math.round((show.bookedSeats / show.totalSeats) * 100)
  return (
    <tr className={show.started ? 'row-muted' : undefined}>
      <td>
        <Link to={`/admin/shows/${show.id}`}>{show.movieTitle}</Link>
      </td>
      <td>{formatDateTime(show.startsAt)}</td>
      <td>{formatMoney(show.pricePaise)}</td>
      <td>
        <div className="occupancy">
          <div className="bar" role="img" aria-label={`${pct}% full`}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <span>
            {show.bookedSeats}/{show.totalSeats} · {pct}%
          </span>
        </div>
      </td>
      <td className="num">{formatMoney(show.revenuePaise)}</td>
      <td className="actions">
        <Link to={`/admin/shows/${show.id}`} className="btn btn-ghost btn-sm">
          View
        </Link>
        <button
          className="btn btn-danger-ghost btn-sm"
          disabled={show.hasBookings || deleting}
          title={show.hasBookings ? 'Shows with bookings cannot be deleted' : undefined}
          onClick={onDelete}
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

function ShowTable({ title, shows }: { title: string; shows: AdminShow[] }) {
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/shows/${id}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['movies'] })
    },
  })
  if (shows.length === 0) return null
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      {remove.isError && <Alert kind="error">{errorMessage(remove.error)}</Alert>}
      <div className="table-wrap card">
        <table className="table">
          <thead>
            <tr>
              <th>Movie</th>
              <th>Starts</th>
              <th>Price</th>
              <th>Booked</th>
              <th className="num">Collected</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shows.map((s) => (
              <ShowRow
                key={s.id}
                show={s}
                deleting={remove.isPending && remove.variables === s.id}
                onDelete={() => window.confirm(`Delete the ${s.movieTitle} show at ${formatDateTime(s.startsAt)}?`) && remove.mutate(s.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Kpis({ shows }: { shows: AdminShow[] }) {
  const upcoming = shows.filter((s) => !s.started)
  const sold = upcoming.reduce((n, s) => n + s.bookedSeats, 0)
  const capacity = upcoming.reduce((n, s) => n + s.totalSeats, 0)
  const revenue = shows.reduce((n, s) => n + s.revenuePaise, 0)
  const today = upcoming.filter((s) => dateKey(s.startsAt) === todayKey()).length
  return (
    <div className="kpis">
      <div className="card kpi">
        <span className="label">Upcoming shows</span>
        <strong>{upcoming.length}</strong>
        <span className="sub">{today} still to play today</span>
      </div>
      <div className="card kpi">
        <span className="label">Seats sold (upcoming)</span>
        <strong>{sold}</strong>
        <span className="sub">of {capacity} seats</span>
      </div>
      <div className="card kpi">
        <span className="label">Average occupancy</span>
        <strong>{capacity ? Math.round((sold / capacity) * 100) : 0}%</strong>
        <span className="sub">across upcoming shows</span>
      </div>
      <div className="card kpi">
        <span className="label">Collected (all time)</span>
        <strong>{formatMoney(revenue)}</strong>
        <span className="sub">tickets + snacks</span>
      </div>
    </div>
  )
}

export default function AdminShowsPage() {
  const { data: shows, isPending, error, refetch } = useQuery(queries.adminShows())

  return (
    <>
      {shows && <Kpis shows={shows} />}
      <AddShowForm />
      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : shows.length === 0 ? (
        <EmptyState title="No shows yet" />
      ) : (
        <>
          <ShowTable title="Upcoming shows" shows={shows.filter((s) => !s.started)} />
          <ShowTable title="Past shows" shows={shows.filter((s) => s.started).reverse()} />
        </>
      )}
    </>
  )
}
