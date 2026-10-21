import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = required('JWT_SECRET');
if (isProduction && jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  isProduction,
  // Secure cookies need HTTPS. On by default in production; COOKIE_SECURE=false allows plain-HTTP local runs.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
  // Built frontend to serve (production / Docker). Unset in development, where Vite serves it.
  staticDir: process.env.STATIC_DIR,
  // The one cinema's local time zone. Admins enter show times in it and shows are grouped by date in it.
  cinemaTimeZone: process.env.CINEMA_TIMEZONE ?? 'Asia/Kolkata',
  sessionDays: 7,
  holdMinutes: 5,
  maxSeatsPerBooking: 6,
  cancelCutoffHours: 2,
};
