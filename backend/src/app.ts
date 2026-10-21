import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { config } from './config.js';
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
  app.use(
    helmet({
      contentSecurityPolicy: {
        // Posters are admin-supplied https URLs on other hosts; everything else stays same-origin.
        directives: { 'img-src': ["'self'", 'data:', 'https:'] },
      },
    }),
  );
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

  app.use('/api', (_req, _res) => {
    throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  });

  // In production the API also serves the built frontend, so browser and API share one origin.
  // Unknown non-API paths return index.html and React Router takes over.
  if (config.staticDir) {
    const dir = path.resolve(config.staticDir);
    // Vite fingerprints files in /assets, so they can be cached forever; the rest must revalidate.
    app.use('/assets', express.static(path.join(dir, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(dir, { index: false }));
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dir, 'index.html'));
    });
  }
  app.use(errorHandler);
  return app;
}
