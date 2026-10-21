-- Genre for browsing/filters (free text such as "Drama, Thriller").
ALTER TABLE movies ADD COLUMN genre text NOT NULL DEFAULT '';

-- Food & beverages that can be pre-ordered with a booking and delivered to the seat.
CREATE TABLE snacks (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category    text NOT NULL CHECK (category IN ('popcorn', 'snacks', 'beverages', 'combos')),
  price_paise integer NOT NULL CHECK (price_paise > 0),
  is_veg      boolean NOT NULL DEFAULT true,
  icon        text NOT NULL DEFAULT '',   -- an emoji, used as the item's picture
  available   boolean NOT NULL DEFAULT true
);

-- Snacks ordered with a booking. unit_price_paise is copied at order time, so later menu price
-- changes never alter what a customer paid.
CREATE TABLE booking_snacks (
  booking_id       uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  snack_id         integer NOT NULL REFERENCES snacks(id),
  quantity         integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price_paise integer NOT NULL CHECK (unit_price_paise > 0),
  PRIMARY KEY (booking_id, snack_id)
);

-- When to bring the order to the seat. NULL when the booking has no snacks.
ALTER TABLE bookings ADD COLUMN snack_delivery text CHECK (snack_delivery IN ('show_start', 'interval'));
