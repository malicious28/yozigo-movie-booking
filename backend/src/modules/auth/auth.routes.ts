import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { HttpError, PG, pgCode } from '../../lib/errors.js';
import { clearAuthCookie, currentUser, requireAuth, setAuthCookie, type AuthUser } from '../../middleware/auth.js';

const BCRYPT_ROUNDS = 10;
// Compared against when the email does not exist, so a login for an unknown email takes as long
// as one with a wrong password and response timing does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);

const signupBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
});

const loginBody = z.object({ email, password: z.string().min(1, 'Password is required') });

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const body = signupBody.parse(req.body);
  const hash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  try {
    // role is never taken from the request: public sign-up always creates a customer.
    const { rows } = await pool.query<AuthUser>(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'customer')
       RETURNING id, name, email, role`,
      [body.name, body.email, hash],
    );
    setAuthCookie(res, rows[0].id);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (pgCode(err) === PG.uniqueViolation) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
});

authRouter.post('/login', async (req, res) => {
  const body = loginBody.parse(req.body);
  const { rows } = await pool.query<AuthUser & { password_hash: string }>(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
    [body.email],
  );
  const row = rows[0];
  const ok = await bcrypt.compare(body.password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    // Same message for unknown email and wrong password.
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }
  setAuthCookie(res, row.id);
  const { password_hash: _, ...user } = row;
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: currentUser(req) });
});
