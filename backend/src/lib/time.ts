import { config } from '../config.js';

// "Sun, 20 Oct, 6:30 pm" in the cinema's time zone, for messages shown to users.
export function formatShowTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: config.cinemaTimeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
