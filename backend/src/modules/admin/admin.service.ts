import { config } from '../../config.js';
import { pool, withTransaction } from '../../db/pool.js';
import { HttpError, notFound, PG, pgCode } from '../../lib/errors.js';
import { ROWS, SEATS_PER_ROW, sortSeats, TOTAL_SEATS } from '../../lib/seats.js';
import { formatShowTime } from '../../lib/time.js';
import { MOVIE_COLUMNS } from '../movies/movies.routes.js';

export interface MovieInput {
  title: string;
  description: string;
  genre: string;
  posterUrl: string | null;
  language: string;
  durationMin: number;
  rating: 'U' | 'UA' | 'A';
}

export interface ShowInput {
  movieId: number;
  date: string; // YYYY-MM-DD, cinema local date
  startTime: string; // HH:MM, cinema local time
  pricePaise: number;
}

// The exclusion constraint on shows is what actually prevents overlaps (even for two admins
// saving at once). This lookup only exists to tell the admin which show is in the way.
async function overlapError(startsAt: Date, endsAt: Date) {
  const { rows } = await pool.query<{ title: string; starts_at: Date; ends_at: Date }>(
    `SELECT m.title, s.starts_at, s.ends_at FROM shows s JOIN movies m ON m.id = s.movie_id
      WHERE tstzrange(s.starts_at, s.ends_at) && tstzrange($1, $2)
      ORDER BY s.starts_at LIMIT 1`,
    [startsAt, endsAt],
  );
  const other = rows[0];
  const detail = other ? ` It overlaps "${other.title}" at ${formatShowTime(other.starts_at)}.` : '';
  return new HttpError(409, 'SHOW_OVERLAP', `There is already a show on the screen at that time.${detail}`);
}

export async function createMovie(input: MovieInput) {
  const { rows } = await pool.query(
    `INSERT INTO movies (title, description, genre, poster_url, language, duration_min, rating)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${MOVIE_COLUMNS}`,
    [input.title, input.description, input.genre, input.posterUrl, input.language, input.durationMin, input.rating],
  );
  return rows[0];
}

// A new duration changes when this movie's future shows end, so their ends_at is recomputed in
// the same transaction; if that makes a show overlap the next one, the whole edit is rejected.
export async function updateMovie(id: number, input: MovieInput) {
  try {
    return await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE movies SET title = $2, description = $3, genre = $4, poster_url = $5, language = $6, duration_min = $7, rating = $8
          WHERE id = $1 RETURNING ${MOVIE_COLUMNS}`,
        [id, input.title, input.description, input.genre, input.posterUrl, input.language, input.durationMin, input.rating],
      );
      if (!rows[0]) throw notFound('Movie');
      await client.query(
        `UPDATE shows SET ends_at = starts_at + make_interval(mins => $2)
          WHERE movie_id = $1 AND starts_at > now()`,
        [id, input.durationMin],
      );
      return rows[0];
    });
  } catch (err) {
    if (pgCode(err) === PG.exclusionViolation) {
      throw new HttpError(
        409,
        'SHOW_OVERLAP',
        'With the new duration, one of this movie\'s upcoming shows would overlap the next show. Move or delete that show first.',
      );
    }
    throw err;
  }
}

// Deleting a movie cascades to its shows, but bookings reference shows with ON DELETE RESTRICT,
// so the database refuses if any of those shows were ever booked.
export async function deleteMovie(id: number) {
  try {
    const { rowCount } = await pool.query('DELETE FROM movies WHERE id = $1', [id]);
    if (!rowCount) throw notFound('Movie');
  } catch (err) {
    if (pgCode(err) === PG.foreignKeyViolation) {
      throw new HttpError(409, 'MOVIE_HAS_BOOKINGS', 'This movie has shows with bookings, so it cannot be deleted');
    }
    throw err;
  }
}

export async function createShow(input: ShowInput) {
  let range: { starts_at: Date; ends_at: Date } | undefined;
  try {
    return await withTransaction(async (client) => {
      // The admin enters a local date and time; Postgres converts it to an absolute timestamp.
      const { rows } = await client.query<{ starts_at: Date; ends_at: Date; in_past: boolean }>(
        `WITH t AS (SELECT ($2::date + $3::time) AT TIME ZONE $4 AS starts_at)
         SELECT t.starts_at, t.starts_at + make_interval(mins => m.duration_min) AS ends_at, t.starts_at <= now() AS in_past
           FROM movies m, t WHERE m.id = $1`,
        [input.movieId, input.date, input.startTime, config.cinemaTimeZone],
      );
      if (!rows[0]) throw notFound('Movie');
      if (rows[0].in_past) throw new HttpError(400, 'SHOW_IN_PAST', 'A show must start in the future');
      range = rows[0];

      const show = await client.query<{ id: number }>(
        'INSERT INTO shows (movie_id, starts_at, ends_at, price_paise) VALUES ($1, $2, $3, $4) RETURNING id',
        [input.movieId, range.starts_at, range.ends_at, input.pricePaise],
      );
      const showId = show.rows[0].id;
      // Create the show's 80 seats: A1..A10 through H1..H10.
      await client.query(
        `INSERT INTO show_seats (show_id, seat_label)
         SELECT $1, r || n FROM unnest($2::text[]) AS r CROSS JOIN generate_series(1, $3) AS n`,
        [showId, ROWS, SEATS_PER_ROW],
      );
      return showId;
    });
  } catch (err) {
    if (pgCode(err) === PG.exclusionViolation && range) throw await overlapError(range.starts_at, range.ends_at);
    throw err;
  }
}

export async function deleteShow(id: number) {
  try {
    const { rowCount } = await pool.query('DELETE FROM shows WHERE id = $1', [id]);
    if (!rowCount) throw notFound('Show');
  } catch (err) {
    if (pgCode(err) === PG.foreignKeyViolation) {
      throw new HttpError(409, 'SHOW_HAS_BOOKINGS', 'This show already has bookings, so it cannot be deleted');
    }
    throw err;
  }
}

// Every show with occupancy and revenue. Cancelled bookings don't count towards either.
export async function listShowsWithStats() {
  const { rows } = await pool.query(
    `SELECT s.id, s.movie_id AS "movieId", m.title AS "movieTitle", s.starts_at AS "startsAt", s.ends_at AS "endsAt",
            s.price_paise AS "pricePaise", s.starts_at <= now() AS started,
            (SELECT count(*)::int FROM show_seats ss WHERE ss.show_id = s.id AND ss.booking_id IS NOT NULL) AS "bookedSeats",
            (SELECT coalesce(sum(b.amount_paise), 0)::int FROM bookings b
              WHERE b.show_id = s.id AND b.status = 'confirmed') AS "revenuePaise",
            EXISTS (SELECT 1 FROM bookings b WHERE b.show_id = s.id) AS "hasBookings"
       FROM shows s JOIN movies m ON m.id = s.movie_id
      ORDER BY s.starts_at`,
  );
  return rows.map((r) => ({ ...r, totalSeats: TOTAL_SEATS }));
}

export async function listShowBookings(showId: number) {
  const exists = await pool.query('SELECT 1 FROM shows WHERE id = $1', [showId]);
  if (!exists.rowCount) throw notFound('Show');
  const { rows } = await pool.query<{ seats: string[] }>(
    `SELECT b.id, b.status, b.amount_paise AS "amountPaise", b.created_at AS "createdAt",
            u.name AS "customerName", u.email AS "customerEmail",
            ARRAY(SELECT seat_label FROM booking_seats bs WHERE bs.booking_id = b.id) AS seats,
            (SELECT string_agg(bk.quantity || ' × ' || sn.name, ', ' ORDER BY sn.name)
               FROM booking_snacks bk JOIN snacks sn ON sn.id = bk.snack_id WHERE bk.booking_id = b.id) AS "snacksSummary"
       FROM bookings b JOIN users u ON u.id = b.user_id
      WHERE b.show_id = $1
      ORDER BY b.created_at`,
    [showId],
  );
  return rows.map((r) => ({ ...r, seats: sortSeats(r.seats) }));
}
