import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { ROWS, SEATS_PER_ROW } from '../src/lib/seats.js';

export const app = createApp();

export async function resetDb() {
  await pool.query('TRUNCATE users, movies, shows, bookings, booking_seats, show_seats RESTART IDENTITY CASCADE');
}

let userCount = 0;
const PASSWORD = 'password123';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4); // low cost: tests don't need slow hashing

// Creates a user directly in the database and returns a supertest agent logged in as them
// (the agent keeps the auth cookie between requests, like a browser).
export async function loginAs(role: 'customer' | 'admin' = 'customer') {
  userCount += 1;
  const email = `${role}${userCount}@test.local`;
  const { rows } = await pool.query<{ id: number }>(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [`${role} ${userCount}`, email, PASSWORD_HASH, role],
  );
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { agent, id: rows[0].id, email };
}

export async function insertMovie(durationMin = 120) {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO movies (title, language, duration_min, rating) VALUES ('Test Movie', 'English', $1, 'U') RETURNING id`,
    [durationMin],
  );
  return rows[0].id;
}

// Inserts a show starting `startsInMinutes` from now (negative = in the past) with its 80 seats.
// Bypasses the admin API so tests can create past shows and shows starting very soon.
export async function insertShow(movieId: number, startsInMinutes: number, pricePaise = 20000) {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO shows (movie_id, starts_at, ends_at, price_paise)
     SELECT $1, now() + make_interval(mins => $2), now() + make_interval(mins => $2 + m.duration_min), $3
       FROM movies m WHERE m.id = $1
     RETURNING id`,
    [movieId, startsInMinutes, pricePaise],
  );
  const showId = rows[0].id;
  await pool.query(
    `INSERT INTO show_seats (show_id, seat_label)
     SELECT $1, r || n FROM unnest($2::text[]) AS r CROSS JOIN generate_series(1, $3) AS n`,
    [showId, ROWS, SEATS_PER_ROW],
  );
  return showId;
}

// Simulates the 5 minutes passing.
export async function expireHolds(showId: number) {
  await pool.query(
    `UPDATE show_seats SET hold_expires_at = now() - interval '1 second' WHERE show_id = $1 AND held_by IS NOT NULL`,
    [showId],
  );
}

export async function seatStates(agent: ReturnType<typeof request.agent>, showId: number) {
  const res = await agent.get(`/api/shows/${showId}/seats`).expect(200);
  return Object.fromEntries(res.body.seats.map((s: { label: string; state: string }) => [s.label, s.state]));
}
