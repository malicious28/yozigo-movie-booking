import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { app, insertMovie, insertShow, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

const signup = (body: object) => request(app).post('/api/auth/signup').send(body);

describe('sign up and log in', () => {
  it('signs up a customer and stores only a bcrypt hash of the password', async () => {
    const res = await signup({ name: 'Asha', email: 'Asha@Example.com', password: 'longenough' }).expect(201);
    expect(res.body.user).toMatchObject({ name: 'Asha', email: 'asha@example.com', role: 'customer' });
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['asha@example.com']);
    expect(rows[0].password_hash).not.toContain('longenough');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('never creates an admin through sign-up', async () => {
    const res = await signup({ name: 'X', email: 'x@example.com', password: 'longenough', role: 'admin' }).expect(201);
    expect(res.body.user.role).toBe('customer');
  });

  it('rejects a duplicate email, ignoring case', async () => {
    await signup({ name: 'A', email: 'dup@example.com', password: 'longenough' }).expect(201);
    const res = await signup({ name: 'B', email: 'DUP@example.com', password: 'longenough' }).expect(409);
    expect(res.body.error.message).toBe('An account with this email already exists');
  });

  it('requires a password of at least 8 characters', async () => {
    const res = await signup({ name: 'A', email: 'a@example.com', password: 'short' }).expect(400);
    expect(res.body.error.message).toContain('at least 8 characters');
  });

  it('gives the same error for an unknown email and a wrong password', async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'longenough' }).expect(201);
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'wrongpass' });
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'b@example.com', password: 'longenough' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('logs out by clearing the cookie', async () => {
    const { agent } = await loginAs();
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('protected API', () => {
  it('rejects booking APIs without a valid login', async () => {
    const showId = await insertShow(await insertMovie(), 24 * 60);
    await request(app).get('/api/bookings').expect(401);
    await request(app).post('/api/bookings').send({ showId, seats: ['A1'] }).expect(401);
    await request(app).post(`/api/shows/${showId}/hold`).send({ seats: ['A1'] }).expect(401);
    await request(app).get(`/api/shows/${showId}/seats`).expect(401);
    await request(app).get('/api/bookings').set('Cookie', 'token=forged.jwt.value').expect(401);
  });

  it('keeps browsing public', async () => {
    await insertShow(await insertMovie(), 24 * 60);
    await request(app).get('/api/movies').expect(200);
    await request(app).get('/api/movies/1').expect(200);
  });
});
