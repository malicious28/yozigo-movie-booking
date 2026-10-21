// Environment for the test run. Shared by vitest.config.ts (test workers) and global-setup.ts.
export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://movie:movie@localhost:5434/movie_booking_test',
  JWT_SECRET: 'test-secret',
};
