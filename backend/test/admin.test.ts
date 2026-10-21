import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { insertMovie, insertShow, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

const movie = { title: 'Dune', description: '', posterUrl: '', language: 'English', durationMin: 120, rating: 'UA' };

// Tomorrow's date in the cinema's time zone (Asia/Kolkata), as the admin form would send it.
const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86_400_000));

describe('admin access', () => {
  it('blocks customers from every admin API', async () => {
    const { agent } = await loginAs('customer');
    await agent.post('/api/admin/movies').send(movie).expect(403);
    await agent.delete('/api/admin/movies/1').expect(403);
    await agent.get('/api/admin/shows').expect(403);
    await agent.post('/api/admin/shows').send({}).expect(403);
  });
});

describe('movies', () => {
  it('adds, edits and deletes a movie', async () => {
    const { agent } = await loginAs('admin');
    const created = (await agent.post('/api/admin/movies').send(movie).expect(201)).body.movie;
    expect(created.posterUrl).toBeNull();

    const edited = await agent.put(`/api/admin/movies/${created.id}`).send({ ...movie, title: 'Dune: Part Two' }).expect(200);
    expect(edited.body.movie.title).toBe('Dune: Part Two');

    await agent.delete(`/api/admin/movies/${created.id}`).expect(204);
    await agent.get(`/api/movies/${created.id}`).expect(404);
  });

  it('only accepts http(s) poster URLs', async () => {
    const { agent } = await loginAs('admin');
    await agent.post('/api/admin/movies').send({ ...movie, posterUrl: 'javascript:alert(1)' }).expect(400);
  });

  it('refuses to delete a movie whose shows have bookings', async () => {
    const { agent } = await loginAs('admin');
    const movieId = await insertMovie();
    const showId = await insertShow(movieId, 24 * 60);
    await agent.post(`/api/shows/${showId}/hold`).send({ seats: ['A1'] }).expect(200);
    await agent.post('/api/bookings').send({ showId, seats: ['A1'] }).expect(201);

    const res = await agent.delete(`/api/admin/movies/${movieId}`).expect(409);
    expect(res.body.error.code).toBe('MOVIE_HAS_BOOKINGS');
  });
});

describe('shows', () => {
  it('creates a show with 80 seats from a local date and time', async () => {
    const { agent } = await loginAs('admin');
    const movieId = await insertMovie(120);
    const res = await agent.post('/api/admin/shows').send({ movieId, date: tomorrow, startTime: '18:30', pricePaise: 25000 }).expect(201);

    // 18:30 in India is 13:00 UTC; ends 120 minutes later.
    expect(res.body.show.startsAt).toBe(`${tomorrow}T13:00:00.000Z`);
    expect(res.body.show.endsAt).toBe(`${tomorrow}T15:00:00.000Z`);
    expect(res.body.show.availableSeats).toBe(80);
  });

  it('rejects overlapping shows but allows back-to-back ones', async () => {
    const { agent } = await loginAs('admin');
    const movieId = await insertMovie(120);
    const post = (startTime: string) => agent.post('/api/admin/shows').send({ movieId, date: tomorrow, startTime, pricePaise: 20000 });

    await post('18:00').expect(201); // 18:00 - 20:00
    const overlap = await post('19:59').expect(409);
    expect(overlap.body.error.code).toBe('SHOW_OVERLAP');
    expect(overlap.body.error.message).toContain('Test Movie');
    await post('16:01').expect(409); // would end at 18:01
    await post('20:00').expect(201); // starts exactly when the first ends
  });

  it('rejects lengthening a movie when that would make its shows overlap', async () => {
    const { agent } = await loginAs('admin');
    const movieId = (await agent.post('/api/admin/movies').send(movie).expect(201)).body.movie.id;
    await agent.post('/api/admin/shows').send({ movieId, date: tomorrow, startTime: '10:00', pricePaise: 20000 }).expect(201);
    await agent.post('/api/admin/shows').send({ movieId, date: tomorrow, startTime: '12:00', pricePaise: 20000 }).expect(201);

    const res = await agent.put(`/api/admin/movies/${movieId}`).send({ ...movie, durationMin: 150 }).expect(409);
    expect(res.body.error.code).toBe('SHOW_OVERLAP');
  });

  it('rejects a show in the past', async () => {
    const { agent } = await loginAs('admin');
    const movieId = await insertMovie();
    const res = await agent.post('/api/admin/shows').send({ movieId, date: '2020-01-01', startTime: '10:00', pricePaise: 20000 }).expect(400);
    expect(res.body.error.code).toBe('SHOW_IN_PAST');
  });

  it('deletes a show without bookings but not one with bookings', async () => {
    const { agent } = await loginAs('admin');
    const movieId = await insertMovie(60);
    const empty = await insertShow(movieId, 24 * 60);
    const booked = await insertShow(movieId, 48 * 60);
    await agent.post(`/api/shows/${booked}/hold`).send({ seats: ['A1'] }).expect(200);
    await agent.post('/api/bookings').send({ showId: booked, seats: ['A1'] }).expect(201);

    await agent.delete(`/api/admin/shows/${empty}`).expect(204);
    const res = await agent.delete(`/api/admin/shows/${booked}`).expect(409);
    expect(res.body.error.code).toBe('SHOW_HAS_BOOKINGS');
  });

  it('reports occupancy, revenue and the bookings of a show', async () => {
    const admin = await loginAs('admin');
    const customer = await loginAs('customer');
    const showId = await insertShow(await insertMovie(), 24 * 60, 30000);
    await customer.agent.post(`/api/shows/${showId}/hold`).send({ seats: ['A1', 'A2', 'A3', 'A4'] }).expect(200);
    await customer.agent.post('/api/bookings').send({ showId, seats: ['A1', 'A2', 'A3', 'A4'] }).expect(201);

    const shows = (await admin.agent.get('/api/admin/shows').expect(200)).body.shows;
    expect(shows[0]).toMatchObject({ bookedSeats: 4, totalSeats: 80, revenuePaise: 120000 });

    const bookings = (await admin.agent.get(`/api/admin/shows/${showId}/bookings`).expect(200)).body.bookings;
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ customerEmail: customer.email, seats: ['A1', 'A2', 'A3', 'A4'] });
  });
});
