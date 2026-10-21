// Every date and time is shown in the cinema's time zone, whatever the viewer's computer is set to.
export const CINEMA_TIME_ZONE = 'Asia/Kolkata'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const dateKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: CINEMA_TIME_ZONE })
const dayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: CINEMA_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: CINEMA_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: CINEMA_TIME_ZONE, hour: 'numeric', minute: '2-digit' })

export const formatMoney = (paise: number) => money.format(paise / 100)
// YYYY-MM-DD in the cinema's time zone; used to group shows by day.
export const dateKey = (iso: string) => dateKeyFmt.format(new Date(iso))
export const formatDay = (iso: string) => dayFmt.format(new Date(iso))
export const formatLongDay = (iso: string) => longDayFmt.format(new Date(iso))
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`

export function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`
}

// Booking IDs are UUIDs; the first block is enough for a person to quote at the counter.
export const shortId = (id: string) => id.slice(0, 8).toUpperCase()

export const todayKey = () => dateKeyFmt.format(new Date())
