export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export const SEATS_PER_ROW = 10
export const MAX_SEATS = 6

// Natural order: A1, A2, ... A10, B1.
export function sortSeats(labels: Iterable<string>): string[] {
  const key = (l: string) => l.charCodeAt(0) * 100 + Number(l.slice(1))
  return [...labels].sort((a, b) => key(a) - key(b))
}

export const TOTAL_SEATS = ROWS.length * SEATS_PER_ROW

// How full a show is, for colour coding show times (like the big booking sites do).
export type Availability = 'available' | 'fast' | 'full' | 'soldout'
export function availability(free: number): Availability {
  if (free === 0) return 'soldout'
  if (free <= TOTAL_SEATS * 0.2) return 'full'
  if (free <= TOTAL_SEATS * 0.5) return 'fast'
  return 'available'
}
export const AVAILABILITY_TEXT: Record<Availability, string> = {
  available: 'Available',
  fast: 'Filling fast',
  full: 'Almost full',
  soldout: 'Sold out',
}
