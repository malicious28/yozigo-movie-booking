// Shared SELECT for a show with its movie and live seat availability.
// Held seats count as unavailable until their hold expires.
export const SHOW_COLUMNS = `
  SELECT s.id, s.movie_id AS "movieId", s.starts_at AS "startsAt", s.ends_at AS "endsAt",
         s.price_paise AS "pricePaise",
         m.title AS "movieTitle", m.language, m.rating, m.duration_min AS "durationMin", m.poster_url AS "posterUrl",
         (SELECT count(*)::int FROM show_seats ss
           WHERE ss.show_id = s.id AND ss.booking_id IS NULL
             AND (ss.held_by IS NULL OR ss.hold_expires_at <= now())) AS "availableSeats",
         s.starts_at <= now() AS started
    FROM shows s
    JOIN movies m ON m.id = s.movie_id`;
