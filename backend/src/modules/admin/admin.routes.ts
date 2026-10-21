import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { idParam } from '../../lib/validation.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { SHOW_COLUMNS } from '../shows/shows.sql.js';
import {
  createMovie,
  createShow,
  deleteMovie,
  deleteShow,
  listShowBookings,
  listShowsWithStats,
  updateMovie,
} from './admin.service.js';

const movieBody = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).default(''),
  // An empty field means "no poster"; the frontend shows a placeholder.
  posterUrl: z
    .string()
    .trim()
    .url('Poster must be a valid URL')
    .max(1000)
    .or(z.literal(''))
    .nullish()
    .transform((v) => v || null),
  language: z.string().trim().min(1, 'Language is required').max(50),
  durationMin: z.number().int().min(1, 'Duration must be at least 1 minute').max(600),
  rating: z.enum(['U', 'UA', 'A']),
});

const showBody = z.object({
  movieId: idParam,
  date: z.string().date('Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:MM'),
  pricePaise: z.number().int().min(100, 'Price must be at least ₹1').max(1_000_000, 'Price must be at most ₹10,000'),
});

export const adminRouter = Router();
// Every admin route checks the role on the server; hiding admin pages in the UI is not enough.
adminRouter.use(requireAuth, requireAdmin);

adminRouter.post('/movies', async (req, res) => {
  res.status(201).json({ movie: await createMovie(movieBody.parse(req.body)) });
});

adminRouter.put('/movies/:id', async (req, res) => {
  res.json({ movie: await updateMovie(idParam.parse(req.params.id), movieBody.parse(req.body)) });
});

adminRouter.delete('/movies/:id', async (req, res) => {
  await deleteMovie(idParam.parse(req.params.id));
  res.status(204).end();
});

adminRouter.get('/shows', async (_req, res) => {
  res.json({ shows: await listShowsWithStats() });
});

adminRouter.post('/shows', async (req, res) => {
  const id = await createShow(showBody.parse(req.body));
  const { rows } = await pool.query(`${SHOW_COLUMNS} WHERE s.id = $1`, [id]);
  res.status(201).json({ show: rows[0] });
});

adminRouter.delete('/shows/:id', async (req, res) => {
  await deleteShow(idParam.parse(req.params.id));
  res.status(204).end();
});

adminRouter.get('/shows/:id/bookings', async (req, res) => {
  res.json({ bookings: await listShowBookings(idParam.parse(req.params.id)) });
});
