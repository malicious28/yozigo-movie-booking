import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, HttpError } from './lib/errors.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { moviesRouter } from './modules/movies/movies.routes.js';
import { showsRouter } from './modules/shows/shows.routes.js';

// No CORS middleware: the frontend reaches the API through the Vite dev proxy (and the same
// origin in production), so the auth cookie is first-party and cross-origin calls are refused.
export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/movies', moviesRouter);
  app.use('/api/shows', showsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/admin', adminRouter);

  app.use((_req, _res) => {
    throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  });
  app.use(errorHandler);
  return app;
}
