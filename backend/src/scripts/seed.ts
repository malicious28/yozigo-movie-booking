import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../lib/errors.js';
import { createMovie, createShow, type MovieInput } from '../modules/admin/admin.service.js';

// Demo data. Safe to run more than once: users are upserted, movies and snacks are matched by
// name, and shows are topped up for the coming days (slots that already exist are skipped).

// The admin role can only be created here, never via the public sign-up endpoint.
const users = [
  { name: 'Cinema Admin', email: 'admin@cinema.test', password: 'admin12345', role: 'admin' },
  { name: 'Test Customer', email: 'customer@cinema.test', password: 'customer123', role: 'customer' },
  { name: 'Second Customer', email: 'customer2@cinema.test', password: 'customer123', role: 'customer' },
];

const movies: MovieInput[] = [
  { title: 'The Last Monsoon', genre: 'Drama, Adventure', language: 'Hindi', durationMin: 135, rating: 'UA', posterUrl: null,
    description: 'A fisherman and his daughter race to get home before the storm of the century hits the Konkan coast.' },
  { title: 'Orbit of Silence', genre: 'Sci-Fi, Thriller', language: 'English', durationMin: 118, rating: 'U', posterUrl: null,
    description: 'Two astronauts lose contact with Earth and have to decide who they can trust.' },
  { title: 'Midnight in Madurai', genre: 'Crime, Mystery', language: 'Tamil', durationMin: 150, rating: 'A', posterUrl: null,
    description: 'A detective has one night to solve a murder during the biggest temple festival of the year.' },
  { title: 'Paper Kites', genre: 'Family, Comedy', language: 'Hindi', durationMin: 128, rating: 'U', posterUrl: null,
    description: "Three siblings enter a kite-flying contest to save their grandfather's rooftop." },
  { title: 'Iron Monarch', genre: 'Action, Fantasy', language: 'Telugu', durationMin: 142, rating: 'UA', posterUrl: null,
    description: 'An exiled prince returns to reclaim a kingdom ruled by a machine.' },
  { title: 'Small Hours', genre: 'Romance, Drama', language: 'Malayalam', durationMin: 112, rating: 'UA', posterUrl: null,
    description: 'Two night-shift workers in Kochi keep meeting at the same tea stall at 3 am.' },
];

// One screen, five slots a day. Every movie is at most 150 minutes, so the slots never overlap.
const slots = [
  { time: '09:30', pricePaise: 18000 },
  { time: '12:15', pricePaise: 22000 },
  { time: '15:00', pricePaise: 25000 },
  { time: '18:00', pricePaise: 28000 },
  { time: '21:00', pricePaise: 28000 },
];
const DAYS = 5;

const snacks = [
  { name: 'Movie Date Combo', category: 'combos', pricePaise: 54900, icon: '🍿', isVeg: true, description: '2 large salted popcorn + 2 Coca-Cola' },
  { name: 'Solo Combo', category: 'combos', pricePaise: 34900, icon: '🎬', isVeg: true, description: 'Regular caramel popcorn + Coca-Cola' },
  { name: 'Salted Popcorn', category: 'popcorn', pricePaise: 22000, icon: '🍿', isVeg: true, description: 'Large tub, freshly popped' },
  { name: 'Caramel Popcorn', category: 'popcorn', pricePaise: 26000, icon: '🍯', isVeg: true, description: 'Large tub, glazed in butter caramel' },
  { name: 'Cheese Popcorn', category: 'popcorn', pricePaise: 28000, icon: '🧀', isVeg: true, description: 'Large tub with cheddar seasoning' },
  { name: 'Nachos with Salsa', category: 'snacks', pricePaise: 24000, icon: '🌮', isVeg: true, description: 'Tortilla chips, salsa and cheese dip' },
  { name: 'Veg Samosa (2 pcs)', category: 'snacks', pricePaise: 12000, icon: '🥟', isVeg: true, description: 'With mint chutney' },
  { name: 'Chicken Burger', category: 'snacks', pricePaise: 26000, icon: '🍔', isVeg: false, description: 'Crispy chicken, lettuce, mayo' },
  { name: 'Coca-Cola (500 ml)', category: 'beverages', pricePaise: 15000, icon: '🥤', isVeg: true, description: 'Chilled' },
  { name: 'Cold Coffee', category: 'beverages', pricePaise: 19000, icon: '🧋', isVeg: true, description: 'With vanilla ice cream' },
  { name: 'Mineral Water', category: 'beverages', pricePaise: 6000, icon: '💧', isVeg: true, description: '1 litre' },
];

// YYYY-MM-DD in the cinema's time zone, `daysAhead` days from today.
function localDate(daysAhead: number) {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.cinemaTimeZone }).format(d);
}

async function seed() {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [u.name, u.email, hash, u.role],
    );
    console.log(`user ${u.email} (${u.role})`);
  }

  for (const s of snacks) {
    await pool.query(
      `INSERT INTO snacks (name, description, category, price_paise, is_veg, icon) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category,
         price_paise = EXCLUDED.price_paise, is_veg = EXCLUDED.is_veg, icon = EXCLUDED.icon`,
      [s.name, s.description, s.category, s.pricePaise, s.isVeg, s.icon],
    );
  }
  console.log(`${snacks.length} snacks`);

  const movieIds: number[] = [];
  for (const movie of movies) {
    const existing = await pool.query<{ id: number }>('SELECT id FROM movies WHERE title = $1', [movie.title]);
    movieIds.push(existing.rows[0]?.id ?? (await createMovie(movie)).id);
  }

  // Shows through the same code path the admin API uses. Movies rotate through the slots by day.
  let added = 0;
  for (let day = 0; day < DAYS; day++) {
    for (const [i, slot] of slots.entries()) {
      const movieId = movieIds[(i + day) % movieIds.length];
      try {
        await createShow({ movieId, date: localDate(day), startTime: slot.time, pricePaise: slot.pricePaise });
        added++;
      } catch (err) {
        // Already scheduled, or today's slot has already passed.
        if (!(err instanceof HttpError && (err.code === 'SHOW_OVERLAP' || err.code === 'SHOW_IN_PAST'))) throw err;
      }
    }
  }
  console.log(`${movies.length} movies, ${added} new shows`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
