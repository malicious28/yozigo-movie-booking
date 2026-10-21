export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export const SEATS_PER_ROW = 10
export const MAX_SEATS = 6

// Natural order: A1, A2, ... A10, B1.
export function sortSeats(labels: Iterable<string>): string[] {
  const key = (l: string) => l.charCodeAt(0) * 100 + Number(l.slice(1))
  return [...labels].sort((a, b) => key(a) - key(b))
}
