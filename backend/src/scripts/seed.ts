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

// Real films, with official posters hotlinked from Wikipedia (the infobox image of each film's
// article). Posters are the studios' copyright and are used here for demo purposes only.
// Runtimes are from each article's infobox; certificates are the CBFC ones.
const WIKI = 'https://upload.wikimedia.org/wikipedia/en';
const movies: MovieInput[] = [
  { title: 'Dune: Part Two', genre: 'Sci-Fi, Adventure', language: 'English', durationMin: 165, rating: 'UA',
    posterUrl: `${WIKI}/5/52/Dune_Part_Two_poster.jpeg`,
    description: 'Paul Atreides unites with Chani and the Fremen on a path of revenge against the conspirators who destroyed his family.' },
  { title: 'Deadpool & Wolverine', genre: 'Action, Comedy', language: 'English', durationMin: 128, rating: 'A',
    posterUrl: `${WIKI}/4/4c/Deadpool_%26_Wolverine_poster.jpg`,
    description: 'A retired Wade Wilson is pulled back into action and has to team up with a very reluctant Wolverine to save his universe.' },
  { title: '12th Fail', genre: 'Drama, Biography', language: 'Hindi', durationMin: 146, rating: 'U',
    posterUrl: `${WIKI}/f/f2/12th_Fail_poster.jpeg`,
    description: 'The true story of Manoj Kumar Sharma, who goes from a village in Chambal to cracking the UPSC exam against all odds.' },
  { title: 'Manjummel Boys', genre: 'Survival, Thriller', language: 'Malayalam', durationMin: 135, rating: 'UA',
    posterUrl: `${WIKI}/9/99/Manjummel_Boys_poster.jpg`,
    description: 'Friends from Kochi on a trip to Kodaikanal must rescue one of their own after he falls into the Guna Caves.' },
  { title: 'Maharaja', genre: 'Action, Thriller', language: 'Tamil', durationMin: 140, rating: 'UA',
    posterUrl: `${WIKI}/8/82/Maharaja_2024_film_poster.jpg`,
    description: 'A barber in Chennai reports a stolen dustbin to the police, setting off a story of mystery and revenge.' },
  { title: 'Hanu-Man', genre: 'Superhero, Fantasy', language: 'Telugu', durationMin: 158, rating: 'UA',
    posterUrl: `${WIKI}/b/bb/Hanu_Man_film_Release_poster.jpeg`,
    description: 'In the village of Anjanadri, a small-time thief gains the powers of Hanuman and has to protect his people.' },
];

// One screen, five slots a day, 3h15 apart: every movie is at most 165 minutes, so the slots
// never overlap (the database's exclusion constraint would reject them if they did).
const slots = [
  { time: '09:00', pricePaise: 18000 },
  { time: '12:15', pricePaise: 22000 },
  { time: '15:30', pricePaise: 25000 },
  { time: '18:45', pricePaise: 28000 },
  { time: '22:00', pricePaise: 25000 },
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
