import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  isProduction: process.env.NODE_ENV === 'production',
  // The one cinema's local time zone. Admins enter show times in it and shows are grouped by date in it.
  cinemaTimeZone: process.env.CINEMA_TIMEZONE ?? 'Asia/Kolkata',
  sessionDays: 7,
  holdMinutes: 5,
  maxSeatsPerBooking: 6,
  cancelCutoffHours: 2,
};
