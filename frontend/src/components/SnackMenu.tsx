import { useState } from 'react'
import type { Snack, SnackCategory, SnackDelivery } from '../api/types'
import { formatMoney } from '../lib/format'
import { VegMark } from './ui'

export type Cart = Record<number, number> // snackId -> quantity
export const MAX_PER_SNACK = 10

const CATEGORY_LABEL: Record<SnackCategory, string> = { combos: 'Combos', popcorn: 'Popcorn', snacks: 'Snacks', beverages: 'Beverages' }

interface Props {
  snacks: Snack[]
  cart: Cart
  onChange: (snackId: number, quantity: number) => void
  delivery: SnackDelivery
  onDelivery: (d: SnackDelivery) => void
}

// The food & beverage step of checkout: a menu with category tabs, quantity steppers and a
// choice of when the order is brought to the seat.
export function SnackMenu({ snacks, cart, onChange, delivery, onDelivery }: Props) {
  const [category, setCategory] = useState<SnackCategory | 'all'>('all')
  const categories = [...new Set(snacks.map((s) => s.category))]
  const visible = category === 'all' ? snacks : snacks.filter((s) => s.category === category)
  const hasItems = Object.values(cart).some((q) => q > 0)

  return (
    <>
      <div className="snack-tabs" role="group" aria-label="Menu category">
        <button className="chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
          All
        </button>
        {categories.map((c) => (
          <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <ul className="snack-grid" style={{ listStyle: 'none', padding: 0 }}>
        {visible.map((s) => {
          const qty = cart[s.id] ?? 0
          return (
            <li key={s.id} className={`snack${qty ? ' in-cart' : ''}`}>
              <div className="snack-icon" aria-hidden>
                {s.icon}
              </div>
              <div>
                <p className="snack-name">
                  <VegMark veg={s.isVeg} /> {s.name}
                </p>
                <p className="snack-desc">{s.description}</p>
              </div>
              <div className="snack-foot">
                <span className="snack-price">{formatMoney(s.pricePaise)}</span>
                {qty === 0 ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => onChange(s.id, 1)} aria-label={`Add ${s.name}`}>
                    Add
                  </button>
                ) : (
                  <span className="qty" role="group" aria-label={`${s.name} quantity`}>
                    <button onClick={() => onChange(s.id, qty - 1)} aria-label={`Remove one ${s.name}`}>
                      −
                    </button>
                    <span aria-live="polite">{qty}</span>
                    <button onClick={() => onChange(s.id, qty + 1)} disabled={qty >= MAX_PER_SNACK} aria-label={`Add one more ${s.name}`}>
                      +
                    </button>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {hasItems && (
        <fieldset className="delivery" style={{ border: 0, padding: 0 }}>
          <legend className="label" style={{ marginBottom: 'var(--s2)' }}>
            When should we bring it to your seat?
          </legend>
          <label>
            <input type="radio" name="delivery" checked={delivery === 'show_start'} onChange={() => onDelivery('show_start')} />
            <span>
              <strong>At the start of the show</strong>
              <br />
              <span className="muted small">Ready as the lights go down</span>
            </span>
          </label>
          <label>
            <input type="radio" name="delivery" checked={delivery === 'interval'} onChange={() => onDelivery('interval')} />
            <span>
              <strong>During the interval</strong>
              <br />
              <span className="muted small">Fresh and hot halfway through</span>
            </span>
          </label>
        </fieldset>
      )}
    </>
  )
}
