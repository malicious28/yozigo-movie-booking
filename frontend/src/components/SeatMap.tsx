import { memo } from 'react'
import type { SeatState } from '../api/types'
import { ROWS, SEATS_PER_ROW } from '../lib/seats'

type Display = 'available' | 'selected' | 'held' | 'booked'

const LABELS: Record<Display, string> = {
  available: 'available',
  selected: 'selected',
  held: 'held by someone else',
  booked: 'booked',
}

interface Props {
  states: Record<string, SeatState>
  selected?: ReadonlySet<string>
  // Omit to render a read-only map (admin view, or while a hold is active).
  onToggle?: (label: string) => void
}

// The 8 x 10 seat grid. Every seat is a real <button> with an accessible name, so the map works
// with keyboard and screen readers, and the states differ by shape/pattern, not only by colour.
export const SeatMap = memo(function SeatMap({ states, selected, onToggle }: Props) {
  return (
    <div className="seatmap">
      <div className="screen" aria-hidden>
        <span>Screen this way</span>
      </div>
      <div className="seat-grid" role="group" aria-label="Seat map. Screen is at the front, row A is closest.">
        {ROWS.map((row) => (
          <div className="seat-row" key={row}>
            <span className="row-label" aria-hidden>
              {row}
            </span>
            {Array.from({ length: SEATS_PER_ROW }, (_, i) => {
              const label = `${row}${i + 1}`
              const state = states[label] ?? 'booked'
              const display: Display = selected?.has(label) || state === 'mine' ? 'selected' : state
              const blocked = display === 'held' || display === 'booked'
              return (
                <button
                  key={label}
                  type="button"
                  className={`seat seat-${display}${i === 4 ? ' seat-aisle' : ''}`}
                  aria-label={`Seat ${label}, ${LABELS[display]}`}
                  aria-pressed={onToggle && !blocked ? display === 'selected' : undefined}
                  disabled={blocked || !onToggle}
                  onClick={() => onToggle?.(label)}
                >
                  {i + 1}
                </button>
              )
            })}
            <span className="row-label" aria-hidden>
              {row}
            </span>
          </div>
        ))}
      </div>
      <ul className="legend" aria-label="Legend">
        {(['available', 'selected', 'held', 'booked'] as const).map((d) => (
          <li key={d}>
            <span className={`seat seat-${d} seat-swatch`} aria-hidden />
            {d === 'held' ? 'Held' : LABELS[d][0].toUpperCase() + LABELS[d].slice(1)}
          </li>
        ))}
      </ul>
    </div>
  )
})
