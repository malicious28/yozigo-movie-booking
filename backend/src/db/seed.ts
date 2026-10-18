import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

// Creates the demo admin and customer. The admin role can only be created here,
// never via the public sign-up endpoint.
const users = [
  { name: 'Cinema Admin', email: 'admin@cinema.test', password: 'admin12345', role: 'admin' },
  { name: 'Test Customer', email: 'customer@cinema.test', password: 'customer123', role: 'customer' },
];

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
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
