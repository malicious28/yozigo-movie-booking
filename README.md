# Movie Ticket Booking

A small cinema booking app: customers pick a show, choose seats on an 8 x 10 seat map and book them. Admins manage movies and shows. A seat can never be booked twice.

> Work in progress. Sections marked TODO will be filled in as the flows are built.

## Stack

| Part     | Choice |
|----------|--------|
| Frontend | React + TypeScript (Vite) |
| Backend  | Node.js + Express + TypeScript, REST API |
| Database | PostgreSQL 16, raw SQL via `pg` |
| Auth     | Email + password (bcrypt), JWT |
| Tests    | Vitest + Supertest against a real Postgres |

## Run locally

Requirements: Node 20+, Docker (for Postgres).

```bash
# 1. Database
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev          # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Test accounts (from `npm run seed`)

| Role     | Email                  | Password      |
|----------|------------------------|---------------|
| Admin    | admin@cinema.test      | admin12345    |
| Customer | customer@cinema.test   | customer123   |

## Flows status

TODO

## Database design

- **users** (id, name, email unique, password_hash, role `customer|admin`, created_at)
- **movies** (id, title, description, poster_url, language, duration_min, rating `U|UA|A`, created_at)
- **shows** (id, movie_id → movies, starts_at, ends_at, price_paise, created_at). An exclusion constraint on `tstzrange(starts_at, ends_at)` prevents overlapping shows.
- **bookings** (id uuid, user_id → users, show_id → shows, amount_paise, status `confirmed|cancelled`, created_at, cancelled_at)
- **show_seats** (show_id → shows, seat_label `A1..H10`, held_by → users, hold_expires_at, booking_id → bookings). Primary key (show_id, seat_label); 80 rows per show.

## Key decisions

TODO

## Assumptions

- Prices are stored in paise (integer) to avoid floating-point rounding.
- All times are stored as `timestamptz`.
