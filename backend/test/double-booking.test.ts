import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { insertMovie, insertShow, loginAs, resetDb, seatStates } from './helpers.js';

// The rule that matters most: a seat can be booked by only one person, even when requests
// arrive at the same moment. These tests fire real concurrent HTTP requests; each one runs on
// its own pooled database connection, so the transactions genuinely overlap in Postgres.

beforeEach(resetDb);
afterAll(() => pool.end());

describe('double booking', () => {
  it('lets exactly one of two users hold the same seat at the same moment', async () => {
    const showId = await insertShow(await insertMovie(), 24 * 60);
    const alice = await loginAs();
    const bob = await loginAs();

    const [a, b] = await Promise.all([
      alice.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['D5', 'D6'] }),
      bob.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['D6', 'D7'] }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('SEATS_UNAVAILABLE');
    expect(loser.body.error.details.seats).toEqual(['D6']);

    // The loser holds nothing (the whole request failed, not just the contested seat).
    const { rows } = await pool.query(
      'SELECT seat_label, held_by FROM show_seats WHERE show_id = $1 AND held_by IS NOT NULL ORDER BY seat_label',
      [showId],
    );
    const winnerId = a.status === 200 ? alice.id : bob.id;
    expect(rows.every((r) => r.held_by === winnerId)).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('produces exactly one booking when 20 users race for the same seat, end to end', async () => {
    const showId = await insertShow(await insertMovie(), 24 * 60);
    const users = await Promise.all(Array.from({ length: 20 }, () => loginAs()));

    // Each user tries the full flow at once: hold, then (if the hold worked) pay successfully.
    const results = await Promise.all(
      users.map(async ({ agent }) => {
        const hold = await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['E5'] });
        if (hold.status !== 200) return hold.status;
        const booking = await agent.post('/api/bookings').send({ showId, seats: ['E5'] });
        return booking.status;
      }),
    );

    expect(results.filter((s) => s === 201)).toHaveLength(1);
    expect(results.filter((s) => s === 409)).toHaveLength(19);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM booking_seats bs JOIN bookings b ON b.id = bs.booking_id
        WHERE b.show_id = $1 AND bs.seat_label = 'E5' AND b.status = 'confirmed'`,
      [showId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('creates only one booking when the same hold is paid twice at once (double click)', async () => {
    const showId = await insertShow(await insertMovie(), 24 * 60);
    const { agent } = await loginAs();
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['A1', 'A2'] }).expect(200);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => agent.post('/api/bookings').send({ showId, seats: ['A1', 'A2'] })),
    );

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM bookings WHERE show_id = $1', [showId]);
    expect(rows[0].n).toBe(1);
  });

  it('never lets a user book a seat someone else has booked', async () => {
    const showId = await insertShow(await insertMovie(), 24 * 60);
    const alice = await loginAs();
    const bob = await loginAs();
    await alice.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['B3'] }).expect(200);
    await alice.agent.post('/api/bookings').send({ showId, seats: ['B3'] }).expect(201);

    // Bob can neither hold it nor skip the hold and book it directly.
    await bob.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['B3'] }).expect(409);
    const direct = await bob.agent.post('/api/bookings').send({ showId, seats: ['B3'] }).expect(409);
    expect(direct.body.error.code).toBe('SEATS_UNAVAILABLE');
    expect((await seatStates(bob.agent, showId)).B3).toBe('booked');
  });
});
