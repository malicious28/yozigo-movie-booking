import type pg from 'pg';
import { config } from '../../config.js';
import { pool, withTransaction } from '../../db/pool.js';
import { HttpError, notFound } from '../../lib/errors.js';
import { sortSeats } from '../../lib/seats.js';

// How double booking is prevented
// --------------------------------
// Every seat of a show is one row in show_seats. Holding and booking both run in a transaction that
// first locks the requested rows with SELECT ... FOR UPDATE, then checks them, then updates them.
// If two requests want the same seat, Postgres makes the second wait at the lock until the first
// commits; it then reads the new state (seat held/booked) and fails. Rows are always locked in
// seat_label order so two requests for overlapping seat sets cannot deadlock.
//
// All time checks use the database clock (now()), never the app server's clock.

interface LockedSeat {
  seat_label: string;
  held_by: number | null;
  hold_active: boolean;
  booking_id: string | null;
}

async function getOpenShow(client: pg.PoolClient, showId: number) {
  const { rows } = await client.query<{ id: number; price_paise: number; started: boolean }>(
    'SELECT id, price_paise, starts_at <= now() AS started FROM shows WHERE id = $1',
    [showId],
  );
  const show = rows[0];
  if (!show) throw notFound('Show');
  if (show.started) throw new HttpError(409, 'SHOW_STARTED', 'This show has already started');
  return show;
}

function seatsUnavailable(labels: string[]) {
  const list = sortSeats(labels).join(', ');
  const verb = labels.length === 1 ? 'is' : 'are';
  return new HttpError(409, 'SEATS_UNAVAILABLE', `Seat ${list} ${verb} no longer available`, { seats: sortSeats(labels) });
}

/**
 * Holds `seats` for the user for config.holdMinutes. Replaces any previous hold the user had on
 * this show (they changed their selection). Fails, holding nothing, if any seat is taken.
 */
export async function holdSeats(userId: number, showId: number, seats: string[]) {
  return withTransaction(async (client) => {
    await getOpenShow(client, showId);

    // Lock the requested seats plus any seats this user currently holds for the show.
    const { rows } = await client.query<LockedSeat>(
      `SELECT seat_label, held_by, hold_expires_at > now() AS hold_active, booking_id
         FROM show_seats
        WHERE show_id = $1 AND (seat_label = ANY($2) OR held_by = $3)
        ORDER BY seat_label
          FOR UPDATE`,
      [showId, seats, userId],
    );

    const taken = rows
      .filter((r) => seats.includes(r.seat_label))
      .filter((r) => r.booking_id !== null || (r.hold_active && r.held_by !== userId))
      .map((r) => r.seat_label);
    if (taken.length > 0) throw seatsUnavailable(taken);

    await client.query(
      `UPDATE show_seats SET held_by = NULL, hold_expires_at = NULL
        WHERE show_id = $1 AND held_by = $2 AND NOT (seat_label = ANY($3))`,
      [showId, userId, seats],
    );
    const updated = await client.query<{ hold_expires_at: Date }>(
      `UPDATE show_seats SET held_by = $3, hold_expires_at = now() + make_interval(mins => $4)
        WHERE show_id = $1 AND seat_label = ANY($2) AND booking_id IS NULL
          AND (held_by IS NULL OR held_by = $3 OR hold_expires_at <= now())
        RETURNING hold_expires_at`,
      [showId, seats, userId, config.holdMinutes],
    );
    // Redundant with the locked check above; a second, independent guard against overwriting a seat.
    if (updated.rowCount !== seats.length) throw seatsUnavailable(seats);
    return { seats: sortSeats(seats), expiresAt: updated.rows[0].hold_expires_at };
  });
}

export async function releaseHold(userId: number, showId: number) {
  await pool.query(
    'UPDATE show_seats SET held_by = NULL, hold_expires_at = NULL WHERE show_id = $1 AND held_by = $2',
    [showId, userId],
  );
}

/**
 * Turns the user's active hold on `seats` into a confirmed booking. Called only after the
 * (simulated) payment succeeded. Every seat must still be held by this user and not expired.
 */
export async function confirmBooking(userId: number, showId: number, seats: string[]) {
  const bookingId = await withTransaction(async (client) => {
    const show = await getOpenShow(client, showId);

    const { rows } = await client.query<LockedSeat>(
      `SELECT seat_label, held_by, hold_expires_at > now() AS hold_active, booking_id
         FROM show_seats
        WHERE show_id = $1 AND seat_label = ANY($2)
        ORDER BY seat_label
          FOR UPDATE`,
      [showId, seats],
    );

    const takenByOthers = rows.filter((r) => r.booking_id !== null || (r.hold_active && r.held_by !== userId));
    if (takenByOthers.length > 0) throw seatsUnavailable(takenByOthers.map((r) => r.seat_label));
    const notHeld = rows.filter((r) => r.held_by !== userId || !r.hold_active);
    if (notHeld.length > 0) {
      throw new HttpError(409, 'HOLD_EXPIRED', 'Your 5-minute hold on these seats has expired. Please select your seats again.');
    }

    const booking = await client.query<{ id: string }>(
      'INSERT INTO bookings (user_id, show_id, amount_paise) VALUES ($1, $2, $3) RETURNING id',
      [userId, showId, show.price_paise * seats.length],
    );
    const id = booking.rows[0].id;
    await client.query('INSERT INTO booking_seats (booking_id, seat_label) SELECT $1, unnest($2::text[])', [id, seats]);

    // `booking_id IS NULL` is redundant with the checks above; it is a last line of defence
    // so a seat already pointing at a booking can never be overwritten.
    const sold = await client.query(
      `UPDATE show_seats SET booking_id = $3, held_by = NULL, hold_expires_at = NULL
        WHERE show_id = $1 AND seat_label = ANY($2) AND booking_id IS NULL`,
      [showId, seats, id],
    );
    if (sold.rowCount !== seats.length) throw seatsUnavailable(seats);

    // Any other seats the user still held for this show are no longer needed.
    await client.query(
      'UPDATE show_seats SET held_by = NULL, hold_expires_at = NULL WHERE show_id = $1 AND held_by = $2',
      [showId, userId],
    );
    return id;
  });
  return (await getBooking(userId, bookingId))!;
}

const BOOKING_SELECT = `
  SELECT b.id, b.status, b.amount_paise AS "amountPaise", b.created_at AS "createdAt",
         b.cancelled_at AS "cancelledAt",
         s.id AS "showId", s.starts_at AS "startsAt", s.ends_at AS "endsAt",
         m.id AS "movieId", m.title AS "movieTitle", m.poster_url AS "posterUrl", m.language,
         ARRAY(SELECT seat_label FROM booking_seats bs WHERE bs.booking_id = b.id) AS seats,
         s.starts_at > now() AS upcoming,
         (b.status = 'confirmed' AND s.starts_at - make_interval(hours => ${config.cancelCutoffHours}) > now()) AS cancellable
    FROM bookings b
    JOIN shows s ON s.id = b.show_id
    JOIN movies m ON m.id = s.movie_id`;

type BookingRow = { seats: string[] } & Record<string, unknown>;
const withSortedSeats = (row: BookingRow) => ({ ...row, seats: sortSeats(row.seats) });

// Every lookup is scoped by user_id, so a user can never read another user's booking even with its ID.
export async function getBooking(userId: number, bookingId: string) {
  const { rows } = await pool.query<BookingRow>(`${BOOKING_SELECT} WHERE b.user_id = $1 AND b.id = $2`, [userId, bookingId]);
  return rows[0] ? withSortedSeats(rows[0]) : null;
}

// Upcoming shows first (soonest first), then past shows (most recent first).
export async function listBookings(userId: number) {
  const { rows } = await pool.query<BookingRow>(
    `${BOOKING_SELECT}
      WHERE b.user_id = $1
      ORDER BY s.starts_at > now() DESC,
               CASE WHEN s.starts_at > now() THEN s.starts_at END ASC,
               s.starts_at DESC, b.created_at DESC`,
    [userId],
  );
  return rows.map(withSortedSeats);
}

export async function cancelBooking(userId: number, bookingId: string) {
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ status: string; started: boolean; too_late: boolean }>(
      `SELECT b.status,
              s.starts_at <= now() AS started,
              s.starts_at - make_interval(hours => $3) <= now() AS too_late
         FROM bookings b JOIN shows s ON s.id = b.show_id
        WHERE b.id = $1 AND b.user_id = $2
          FOR UPDATE OF b`,
      [bookingId, userId, config.cancelCutoffHours],
    );
    const booking = rows[0];
    if (!booking) throw notFound('Booking');
    if (booking.status === 'cancelled') throw new HttpError(409, 'ALREADY_CANCELLED', 'This booking is already cancelled');
    if (booking.started) throw new HttpError(409, 'SHOW_STARTED', 'This show has already started and cannot be cancelled');
    if (booking.too_late) {
      throw new HttpError(
        409,
        'TOO_LATE_TO_CANCEL',
        `Bookings can only be cancelled up to ${config.cancelCutoffHours} hours before the show starts`,
      );
    }

    await client.query(`UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [bookingId]);
    // Free the seats immediately. booking_seats keeps the record of what was booked.
    await client.query('UPDATE show_seats SET booking_id = NULL WHERE booking_id = $1', [bookingId]);
  });
  return (await getBooking(userId, bookingId))!;
}
