CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE users (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,          -- stored lower-cased
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
CREATE TABLE shows (
  id          serial PRIMARY KEY,
  movie_id    integer NOT NULL REFERENCES movies(id) ON DELETE RESTRICT,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  price_paise integer NOT NULL CHECK (price_paise >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)
);

CREATE TABLE bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      integer NOT NULL REFERENCES users(id),
  show_id      integer NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
  amount_paise integer NOT NULL,
  status       text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);
CREATE INDEX bookings_user_idx ON bookings (user_id);
CREATE INDEX bookings_show_idx ON bookings (show_id);

-- One row per seat per show (80 rows inserted when a show is created).
-- The primary key means a seat physically exists once per show, so holding/booking is an
-- UPDATE on that row under a row lock: two concurrent buyers can never both win it.
--   available: held_by IS NULL AND booking_id IS NULL (or the hold has expired)
--   held:      held_by set and hold_expires_at > now()
--   booked:    booking_id set
CREATE TABLE show_seats (
  show_id         integer NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_label      text NOT NULL CHECK (seat_label ~ '^[A-H]([1-9]|10)$'),
  held_by         integer REFERENCES users(id),
  hold_expires_at timestamptz,
  booking_id      uuid REFERENCES bookings(id),
  PRIMARY KEY (show_id, seat_label)
);
CREATE INDEX show_seats_booking_idx ON show_seats (booking_id);
