import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { app, expireHolds, insertMovie, insertShow, loginAs, resetDb, seatStates } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

const TOMORROW = 24 * 60;

describe('browsing', () => {
  it('lists only shows that have not started, with seats still available', async () => {
    const movieId = await insertMovie();
    await insertShow(movieId, -30); // already started
    const upcoming = await insertShow(movieId, TOMORROW);
    const { agent } = await loginAs();
    await agent.post(`/api/shows/${upcoming}/hold`).send({ seats: ['A1', 'A2'] }).expect(200);

    const res = await request(app).get(`/api/movies/${movieId}`).expect(200);
    expect(res.body.shows.map((s: { id: number }) => s.id)).toEqual([upcoming]);
    expect(res.body.shows[0].availableSeats).toBe(78);
  });
});

describe('holding seats', () => {
  it('shows my held seats as mine and to others as held', async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW);
    const alice = await loginAs();
    const bob = await loginAs();
    const res = await alice.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['C4', 'C5'] }).expect(200);
    expect(res.body.hold.seats).toEqual(['C4', 'C5']);

    const aliceView = await alice.agent.get(`/api/shows/${showId}/seats`).expect(200);
    expect(aliceView.body.seats).toHaveLength(80);
    expect(aliceView.body.myHold.seats).toEqual(['C4', 'C5']);
    expect((await seatStates(bob.agent, showId)).C4).toBe('held');
  });

  it('rejects more than 6 seats', async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW);
    const { agent } = await loginAs();
    const seats = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
    const res = await agent.post(`/api/shows/${showId}/hold`).send({ seats }).expect(400);
    expect(res.body.error.message).toContain('at most 6 seats');
  });

  it('replaces my previous hold when I change my selection', async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW);
    const { agent } = await loginAs();
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['A1', 'A2'] }).expect(200);
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['A2', 'A3'] }).expect(200);
    const states = await seatStates(agent, showId);
    expect([states.A1, states.A2, states.A3]).toEqual(['available', 'mine', 'mine']);
  });

  it('makes seats available to everyone once the hold expires', async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW);
    const alice = await loginAs();
    const bob = await loginAs();
    await alice.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['F1'] }).expect(200);
    await bob.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['F1'] }).expect(409);

    await expireHolds(showId);

    expect((await seatStates(bob.agent, showId)).F1).toBe('available');
    await bob.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['F1'] }).expect(200);
  });

  it('refuses holds for a show that has started', async () => {
    const showId = await insertShow(await insertMovie(), -5);
    const { agent } = await loginAs();
    const res = await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['A1'] }).expect(409);
    expect(res.body.error.code).toBe('SHOW_STARTED');
  });
});

describe('paying', () => {
  it('confirms a booking with the right amount and marks the seats booked', async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW, 25000);
    const { agent } = await loginAs();
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['C5', 'C4'] }).expect(200);
    const res = await agent.post('/api/bookings').send({ showId, seats: ['C5', 'C4'] }).expect(201);

    expect(res.body.booking).toMatchObject({ status: 'confirmed', amountPaise: 50000, seats: ['C4', 'C5'], movieTitle: 'Test Movie' });
    const states = await seatStates(agent, showId);
    expect([states.C4, states.C5]).toEqual(['booked', 'booked']);
  });

  it('rejects payment after the hold has expired', async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW);
    const { agent } = await loginAs();
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['C4'] }).expect(200);
    await expireHolds(showId);

    const res = await agent.post('/api/bookings').send({ showId, seats: ['C4'] }).expect(409);
    expect(res.body.error.code).toBe('HOLD_EXPIRED');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM bookings');
    expect(rows[0].n).toBe(0);
  });

  it('rejects booking seats that were never held', async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW);
    const { agent } = await loginAs();
    await agent.post('/api/bookings').send({ showId, seats: ['C4'] }).expect(409);
  });
});

describe('my bookings', () => {
  async function book(agent: Awaited<ReturnType<typeof loginAs>>['agent'], showId: number, seats: string[]) {
    await agent.post(`/api/shows/${showId}/hold`).send({ seats }).expect(200);
    return (await agent.post('/api/bookings').send({ showId, seats }).expect(201)).body.booking;
  }

  it('lists upcoming bookings first (soonest first), then past ones', async () => {
    const movieId = await insertMovie(60);
    const later = await insertShow(movieId, 3 * TOMORROW);
    const sooner = await insertShow(movieId, TOMORROW);
    const past = await insertShow(movieId, 2 * TOMORROW);
    const { agent } = await loginAs();
    await book(agent, later, ['A1']);
    await book(agent, sooner, ['A1']);
    await book(agent, past, ['A1']);
    // Move one show into the past (it can't be booked once started, so book first).
    await pool.query(`UPDATE shows SET starts_at = now() - interval '2 days', ends_at = now() - interval '2 days' + interval '1 hour' WHERE id = $1`, [past]);

    const res = await agent.get('/api/bookings').expect(200);
    expect(res.body.bookings.map((b: { showId: number }) => b.showId)).toEqual([sooner, later, past]);
    expect(res.body.bookings.every((b: { upcoming: boolean; showId: number }) => b.upcoming === (b.showId !== past))).toBe(true);
  });

  it("never shows a user someone else's booking", async () => {
    const showId = await insertShow(await insertMovie(), TOMORROW);
    const alice = await loginAs();
    const bob = await loginAs();
    const booking = await book(alice.agent, showId, ['A1']);

    await bob.agent.get(`/api/bookings/${booking.id}`).expect(404);
    await bob.agent.post(`/api/bookings/${booking.id}/cancel`).expect(404);
    expect((await bob.agent.get('/api/bookings').expect(200)).body.bookings).toEqual([]);
    await alice.agent.get(`/api/bookings/${booking.id}`).expect(200);
  });
});

describe('cancelling', () => {
  it('cancels more than 2 hours ahead and frees the seats immediately', async () => {
    const showId = await insertShow(await insertMovie(), 3 * 60);
    const { agent } = await loginAs();
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['G7'] }).expect(200);
    const { booking } = (await agent.post('/api/bookings').send({ showId, seats: ['G7'] }).expect(201)).body;

    const res = await agent.post(`/api/bookings/${booking.id}/cancel`).expect(200);
    expect(res.body.booking).toMatchObject({ status: 'cancelled', seats: ['G7'] });
    expect((await seatStates(agent, showId)).G7).toBe('available');
  });

  it('refuses to cancel within 2 hours of the show', async () => {
    const showId = await insertShow(await insertMovie(), 3 * 60);
    const { agent } = await loginAs();
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['G7'] }).expect(200);
    const { booking } = (await agent.post('/api/bookings').send({ showId, seats: ['G7'] }).expect(201)).body;
    await pool.query(`UPDATE shows SET starts_at = now() + interval '90 minutes', ends_at = now() + interval '4 hours' WHERE id = $1`, [showId]);

    const res = await agent.post(`/api/bookings/${booking.id}/cancel`).expect(409);
    expect(res.body.error.code).toBe('TOO_LATE_TO_CANCEL');
    expect((await seatStates(agent, showId)).G7).toBe('booked');
  });
});
