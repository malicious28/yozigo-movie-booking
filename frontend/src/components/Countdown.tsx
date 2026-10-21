export function Countdown({ remainingMs }: { remainingMs: number }) {
  const total = Math.ceil(remainingMs / 1000)
  const mm = Math.floor(total / 60)
  const ss = (total % 60).toString().padStart(2, '0')
  const urgent = total <= 60
  return (
    <div className={`countdown${urgent ? ' countdown-urgent' : ''}`}>
      <span className="countdown-label">Seats held for</span>
      {/* Announce only occasionally to screen readers, not every second. */}
      <span className="countdown-time" aria-live={total % 60 === 0 || total === 30 ? 'polite' : 'off'}>
        {mm}:{ss}
      </span>
    </div>
  )
}
