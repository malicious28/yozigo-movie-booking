import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { sortSeats } from '../../lib/seats.js';
import { idParam, seatList } from '../../lib/validation.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { holdSeats, releaseHold } from '../bookings/bookings.service.js';
import { SHOW_COLUMNS } from './shows.sql.js';

export const showsRouter = Router();

showsRouter.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`${SHOW_COLUMNS} WHERE s.id = $1`, [idParam.parse(req.params.id)]);
  if (!rows[0]) throw notFound('Show');
  res.json({ show: rows[0] });
});

type SeatState = 'available' | 'held' | 'mine' | 'booked';

// The seat map. Needs a login because it reports which held seats are the caller's own.
// serverTime lets the client run the hold countdown against the server clock, not its own.
showsRouter.get('/:id/seats', requireAuth, async (req, res) => {
  const showId = idParam.parse(req.params.id);
  const userId = currentUser(req).id;
  const { rows } = await pool.query<{ label: string; state: SeatState; hold_expires_at: Date | null }>(
    `SELECT seat_label AS label, hold_expires_at,
            CASE WHEN booking_id IS NOT NULL THEN 'booked'
                 WHEN held_by IS NOT NULL AND hold_expires_at > now()
                   THEN CASE WHEN held_by = $2 THEN 'mine' ELSE 'held' END
                 ELSE 'available'
            END AS state
       FROM show_seats WHERE show_id = $1`,
    [showId, userId],
  );
  if (rows.length === 0) throw notFound('Show');

  const mine = rows.filter((r) => r.state === 'mine');
  res.json({
    seats: rows.map(({ label, state }) => ({ label, state })),
    myHold: mine.length ? { seats: sortSeats(mine.map((r) => r.label)), expiresAt: mine[0].hold_expires_at } : null,
    serverTime: new Date(),
  });
});

const holdBody = z.object({ seats: seatList });

showsRouter.post('/:id/hold', requireAuth, async (req, res) => {
  const { seats } = holdBody.parse(req.body);
  const hold = await holdSeats(currentUser(req).id, idParam.parse(req.params.id), seats);
  res.json({ hold, serverTime: new Date() });
});

showsRouter.delete('/:id/hold', requireAuth, async (req, res) => {
  await releaseHold(currentUser(req).id, idParam.parse(req.params.id));
  res.status(204).end();
});
