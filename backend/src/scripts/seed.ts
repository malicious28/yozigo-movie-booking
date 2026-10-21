import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { createMovie, createShow, type MovieInput } from '../modules/admin/admin.service.js';
import { config } from '../config.js';

// Creates the demo admin and customer. The admin role can only be created here,
// never via the public sign-up endpoint. Safe to run more than once.
const users = [
  { name: 'Cinema Admin', email: 'admin@cinema.test', password: 'admin12345', role: 'admin' },
  { name: 'Test Customer', email: 'customer@cinema.test', password: 'customer123', role: 'customer' },
  { name: 'Second Customer', email: 'customer2@cinema.test', password: 'customer123', role: 'customer' },
];

const movies: (MovieInput & { times: string[] })[] = [
  {
    title: 'The Last Monsoon',
    description: 'A fisherman and his daughter race to get home before the storm of the century hits the coast.',
    posterUrl: 'https://picsum.photos/seed/monsoon/300/450',
    language: 'Hindi',
    durationMin: 135,
    rating: 'UA',
    times: ['10:00', '18:30'],
  },
  {
    title: 'Orbit of Silence',
    description: 'Two astronauts lose contact with Earth and have to decide who they trust.',
    posterUrl: 'https://picsum.photos/seed/orbit/300/450',
    language: 'English',
    durationMin: 118,
    rating: 'U',
    times: ['13:00'],
  },
  {
    title: 'Midnight in Madurai',
    description: 'A detective has one night to solve a murder at a temple festival.',
    posterUrl: null,
    language: 'Tamil',
    durationMin: 150,
    rating: 'A',
    times: ['15:30', '21:30'],
  },
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
    console.log(`seeded ${u.role} ${u.email}`);
  }

  const { rows } = await pool.query('SELECT 1 FROM movies LIMIT 1');
  if (rows.length > 0) {
    console.log('movies already exist, skipping demo movies and shows');
    return;
  }
  // Shows for the next 3 days, created through the same code path the admin API uses.
  for (const { times, ...movie } of movies) {
    const created = await createMovie(movie);
    for (let day = 1; day <= 3; day++) {
      for (const startTime of times) {
        await createShow({ movieId: created.id, date: localDate(day), startTime, pricePaise: 25000 });
      }
    }
    console.log(`seeded movie "${movie.title}"`);
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
