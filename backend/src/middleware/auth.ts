import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../lib/errors.js';

export type Role = 'customer' | 'admin';
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const COOKIE_NAME = 'token';

// The JWT lives in an httpOnly cookie so page scripts (and any XSS) cannot read it.
// SameSite=Lax stops other sites from sending it on cross-site POSTs (CSRF).
export function setAuthCookie(res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: `${config.sessionDays}d` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Verifies the token and loads the user from the database on every request, so a deleted user
// or a changed role takes effect immediately instead of when the token expires.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in');

  let userId: number;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    userId = Number(payload.sub);
  } catch {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired, please log in again');
  }

  const { rows } = await pool.query<AuthUser>('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in');
  req.user = rows[0];
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Admins only');
  next();
};

// For handlers mounted behind requireAuth.
export function currentUser(req: Express.Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in');
  return req.user;
}
