import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { idParam } from '../../lib/validation.js';
import { SHOW_COLUMNS } from '../shows/shows.sql.js';

export const MOVIE_COLUMNS = `
  id, title, description, genre, poster_url AS "posterUrl", language,
  duration_min AS "durationMin", rating`;

export const moviesRouter = Router();

moviesRouter.get('/', async (_req, res) => {
  // Movies with upcoming shows first (soonest first), each with its next show time for the listing.
  const { rows } = await pool.query(
    `SELECT ${MOVIE_COLUMNS},
            (SELECT min(s.starts_at) FROM shows s WHERE s.movie_id = movies.id AND s.starts_at > now()) AS "nextShowAt",
            (SELECT count(*)::int FROM shows s WHERE s.movie_id = movies.id AND s.starts_at > now()) AS "upcomingShows"
       FROM movies
      ORDER BY "nextShowAt" NULLS LAST, title`,
  );
  res.json({ movies: rows });
});

// Movie details plus its shows that have not started yet. Grouping by date is done by the client.
moviesRouter.get('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const movie = await pool.query(`SELECT ${MOVIE_COLUMNS} FROM movies WHERE id = $1`, [id]);
  if (!movie.rows[0]) throw notFound('Movie');
  const shows = await pool.query(
    `${SHOW_COLUMNS} WHERE s.movie_id = $1 AND s.starts_at > now() ORDER BY s.starts_at`,
    [id],
  );
  res.json({ movie: movie.rows[0], shows: shows.rows });
});
