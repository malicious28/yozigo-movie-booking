import { migrate } from '../db/migrate.js';
import { pool } from '../db/pool.js';

migrate(pool, console.log)
  .then(() => console.log('migrations up to date'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
