import pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import { testEnv } from './test-env.js';

// Creates the test database if needed and rebuilds its schema from the migrations, so every
// run starts from exactly what `npm run migrate` produces.
export default async function setup() {
  const url = new URL(testEnv.DATABASE_URL);
  const dbName = url.pathname.slice(1);

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: url.toString() });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
  await pool.end();
}
