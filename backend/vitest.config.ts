import { defineConfig } from 'vitest/config';
import { testEnv } from './test/test-env.js';

export default defineConfig({
  test: {
    // Tests hit a real Postgres (a separate database, created by global-setup) because the
    // behaviour under test - row locks, constraints, transactions - only exists in the database.
    env: testEnv,
    globalSetup: './test/global-setup.ts',
    // All test files share one database, so run them one file at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
