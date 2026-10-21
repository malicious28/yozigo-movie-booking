// The single screen's layout: rows A-H, seats 1-10.
export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const SEATS_PER_ROW = 10;
export const TOTAL_SEATS = ROWS.length * SEATS_PER_ROW;

const SEAT_RE = /^([A-H])([1-9]|10)$/;

export function isValidSeat(label: string): boolean {
  return SEAT_RE.test(label);
}

// Natural order (A1, A2, ... A10, B1) for display. Locking order uses plain text order in SQL,
// which is equally consistent; it only has to be the same for every transaction.
export function compareSeats(a: string, b: string): number {
  const [, ra, na] = SEAT_RE.exec(a)!;
  const [, rb, nb] = SEAT_RE.exec(b)!;
  return ra === rb ? Number(na) - Number(nb) : ra.localeCompare(rb);
}

export const sortSeats = (labels: string[]) => [...labels].sort(compareSeats);
