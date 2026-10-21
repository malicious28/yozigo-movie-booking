import { useEffect, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import type { BookingStatus, Rating } from '../api/types'

export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <span className="spinner" aria-hidden /> Loading…
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <span>{errorMessage(error)}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Alert({ kind, children }: { kind: 'error' | 'success' | 'info' | 'warning'; children: ReactNode }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  )
}

export function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span className={`badge badge-rating-${rating}`} title={`Rated ${rating}`}>
      {rating}
    </span>
  )
}

export function StatusBadge({ status, upcoming }: { status: BookingStatus; upcoming?: boolean }) {
  if (status === 'cancelled') return <span className="badge badge-muted">Cancelled</span>
  return upcoming === false ? <span className="badge badge-muted">Completed</span> : <span className="badge badge-success">Confirmed</span>
}

// A stable hue per title, so placeholders look distinct but consistent across pages.
const hueOf = (title: string) => [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

// Shows the poster, falling back to a typographic placeholder if there is none or it fails to load.
// referrerPolicy keeps our URLs out of third-party image hosts' logs.
export function Poster({ url, title, size = 'md' }: { url: string | null; title: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <div
        className={`poster poster-${size} poster-placeholder`}
        style={{ background: `linear-gradient(160deg, hsl(${hueOf(title)} 45% 34%), hsl(${hueOf(title)} 50% 14%))` }}
        aria-hidden
      >
        <span>{title}</span>
      </div>
    )
  }
  return (
    <img
      className={`poster poster-${size}`}
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

// Accessible modal on the native <dialog> element: focus trapping, Esc and the backdrop come for free.
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose?.()
      }}
    >
      <h2 id="modal-title" className="modal-title">
        {title}
      </h2>
      {children}
    </dialog>
  )
}
