CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE users (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE movies (
  id           serial PRIMARY KEY,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  poster_url   text,
  language     text NOT NULL,
  duration_min integer NOT NULL CHECK (duration_min > 0),
  rating       text NOT NULL CHECK (rating IN ('U', 'UA', 'A')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One screen, so no two shows may overlap in time. ends_at = starts_at + movie duration,
-- and the exclusion constraint makes the database reject overlaps even under concurrency.
-- Deleting a movie cascades to its shows, but bookings block the delete (see bookings.show_id).
CREATE TABLE shows (
  id          serial PRIMARY KEY,
  movie_id    integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  price_paise integer NOT NULL CHECK (price_paise > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)
);
CREATE INDEX shows_movie_starts_idx ON shows (movie_id, starts_at);

-- Created only when payment succeeds; a hold is not a booking.
-- RESTRICT on show_id is what stops a show (or its movie) from being deleted once booked.
CREATE TABLE bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      integer NOT NULL REFERENCES users(id),
  show_id      integer NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  status       text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX bookings_user_idx ON bookings (user_id);
CREATE INDEX bookings_show_idx ON bookings (show_id);

-- Permanent record of which seats a booking was for. Kept after cancellation,
-- whereas show_seats.booking_id is cleared so the seat can be sold again.
CREATE TABLE booking_seats (
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_label text NOT NULL,
  PRIMARY KEY (booking_id, seat_label)
);

-- The seat inventory: one row per seat per show (80 rows inserted when a show is created).
-- A seat exists exactly once per show (primary key) and has a single booking_id column, so it
-- can only ever belong to one booking. Holding and booking lock these rows (SELECT ... FOR UPDATE)
-- before changing them, so two concurrent buyers are serialised and only one can win.
--   available: booking_id IS NULL AND (held_by IS NULL OR hold_expires_at <= now())
--   held:      booking_id IS NULL AND held_by IS NOT NULL AND hold_expires_at > now()
--   booked:    booking_id IS NOT NULL
-- Expired holds are simply ignored by every query, so no background job is needed for correctness.
CREATE TABLE show_seats (
  show_id         integer NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_label      text NOT NULL CHECK (seat_label ~ '^[A-H]([1-9]|10)$'),
  held_by         integer REFERENCES users(id) ON DELETE SET NULL,
  hold_expires_at timestamptz,
  booking_id      uuid REFERENCES bookings(id),
  PRIMARY KEY (show_id, seat_label),
  CHECK ((held_by IS NULL) = (hold_expires_at IS NULL)),
  CHECK (booking_id IS NULL OR held_by IS NULL)
);
CREATE INDEX show_seats_booking_idx ON show_seats (booking_id);
CREATE INDEX show_seats_held_by_idx ON show_seats (held_by) WHERE held_by IS NOT NULL;
