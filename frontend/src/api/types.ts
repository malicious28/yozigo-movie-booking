// Shapes of the backend's JSON responses. Timestamps arrive as ISO strings (UTC).

export type Role = 'customer' | 'admin'
export type Rating = 'U' | 'UA' | 'A'
export type SeatState = 'available' | 'held' | 'mine' | 'booked'
export type BookingStatus = 'confirmed' | 'cancelled'

export interface User {
  id: number
  name: string
  email: string
  role: Role
}

export interface Movie {
  id: number
  title: string
  description: string
  posterUrl: string | null
  language: string
  durationMin: number
  rating: Rating
}

export interface Show {
  id: number
  movieId: number
  movieTitle: string
  startsAt: string
  endsAt: string
  pricePaise: number
  language: string
  rating: Rating
  durationMin: number
  posterUrl: string | null
  availableSeats: number
  started: boolean
}

export interface Hold {
  seats: string[]
  expiresAt: string
}

export interface SeatMapResponse {
  seats: { label: string; state: SeatState }[]
  myHold: Hold | null
  serverTime: string
}

export interface Booking {
  id: string
  status: BookingStatus
  amountPaise: number
  createdAt: string
  cancelledAt: string | null
  showId: number
  startsAt: string
  endsAt: string
  movieId: number
  movieTitle: string
  posterUrl: string | null
  language: string
  seats: string[]
  upcoming: boolean
  cancellable: boolean
}

export interface AdminShow {
  id: number
  movieId: number
  movieTitle: string
  startsAt: string
  endsAt: string
  pricePaise: number
  started: boolean
  bookedSeats: number
  totalSeats: number
  revenuePaise: number
  hasBookings: boolean
}

export interface AdminBooking {
  id: string
  status: BookingStatus
  amountPaise: number
  createdAt: string
  customerName: string
  customerEmail: string
  seats: string[]
}
