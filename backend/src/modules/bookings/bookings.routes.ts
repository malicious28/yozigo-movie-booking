import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { idParam, seatList } from '../../lib/validation.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { cancelBooking, confirmBooking, getBooking, listBookings } from './bookings.service.js';

const createBody = z.object({
  showId: idParam,
  seats: seatList,
  snacks: z
    .array(z.object({ snackId: idParam, quantity: z.number().int().min(1).max(10, 'At most 10 of each snack') }))
    .max(20)
    .refine((list) => new Set(list.map((s) => s.snackId)).size === list.length, 'Each snack must appear once')
    .default([]),
  snackDelivery: z.enum(['show_start', 'interval']).default('show_start'),
});
// A malformed ID can't belong to the user, so it is reported the same way as someone else's ID.
const bookingId = (raw: string) => {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw notFound('Booking');
  return parsed.data;
};

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

// Confirms a held set of seats. The client calls this only when the simulated payment succeeds.
bookingsRouter.post('/', async (req, res) => {
  const body = createBody.parse(req.body);
  const booking = await confirmBooking(currentUser(req).id, body.showId, body.seats, body.snacks, body.snackDelivery);
  res.status(201).json({ booking });
});

bookingsRouter.get('/', async (req, res) => {
  res.json({ bookings: await listBookings(currentUser(req).id) });
});

// 404 (not 403) for another user's booking, so the API doesn't reveal that the ID exists.
bookingsRouter.get('/:id', async (req, res) => {
  const booking = await getBooking(currentUser(req).id, bookingId(req.params.id));
  if (!booking) throw notFound('Booking');
  res.json({ booking });
});

bookingsRouter.post('/:id/cancel', async (req, res) => {
  const booking = await cancelBooking(currentUser(req).id, bookingId(req.params.id));
  res.json({ booking });
});
