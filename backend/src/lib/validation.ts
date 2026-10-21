import { z } from 'zod';
import { config } from '../config.js';
import { isValidSeat } from './seats.js';

export const idParam = z.coerce.number().int().positive();

export const seatList = z
  .array(z.string().refine(isValidSeat, 'Invalid seat'))
  .min(1, 'Select at least one seat')
  .max(config.maxSeatsPerBooking, `You can select at most ${config.maxSeatsPerBooking} seats`)
  .refine((seats) => new Set(seats).size === seats.length, 'Seats must not repeat');
