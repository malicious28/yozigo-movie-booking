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
  genre: string
  posterUrl: string | null
  language: string
  durationMin: number
  rating: Rating
  // Only in the movie list.
  nextShowAt?: string | null
  upcomingShows?: number
}

export type SnackCategory = 'combos' | 'popcorn' | 'snacks' | 'beverages'
export type SnackDelivery = 'show_start' | 'interval'

export interface Snack {
  id: number
  name: string
  description: string
  category: SnackCategory
  pricePaise: number
  isVeg: boolean
  icon: string
}

export interface BookedSnack {
  name: string
  icon: string
  quantity: number
  unitPricePaise: number
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
  ticketsPaise: number
  snacks: BookedSnack[]
  snackDelivery: SnackDelivery | null
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
  snacksSummary: string | null
}
