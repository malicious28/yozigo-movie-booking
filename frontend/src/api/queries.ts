import { queryOptions } from '@tanstack/react-query'
import { api, ApiError } from './client'
import type { AdminBooking, AdminShow, Booking, Movie, SeatMapResponse, Show, Snack, User } from './types'

// All query keys and fetchers live here, so pages share cache entries and invalidation
// (e.g. after booking, invalidating ['bookings'] refreshes "My bookings" wherever it is shown).

export const SEAT_POLL_MS = 3000

export const queries = {
  me: () =>
    queryOptions({
      queryKey: ['me'],
      // 401 just means "not logged in", which is a normal state rather than an error.
      queryFn: () =>
        api.get<{ user: User }>('/auth/me').then(
          (r): User | null => r.user,
          (err) => {
            if (err instanceof ApiError && err.status === 401) return null
            throw err
          },
        ),
      retry: false,
      staleTime: Infinity,
    }),
  movies: () => queryOptions({ queryKey: ['movies'], queryFn: () => api.get<{ movies: Movie[] }>('/movies').then((r) => r.movies) }),
  movie: (id: number) =>
    queryOptions({ queryKey: ['movies', id], queryFn: () => api.get<{ movie: Movie; shows: Show[] }>(`/movies/${id}`) }),
  show: (id: number) => queryOptions({ queryKey: ['shows', id], queryFn: () => api.get<{ show: Show }>(`/shows/${id}`).then((r) => r.show) }),
  // Polled while the page is visible: live seat updates (flow 10). TanStack Query pauses the
  // interval when the tab is in the background, so idle tabs cost nothing.
  seats: (id: number) =>
    queryOptions({
      queryKey: ['shows', id, 'seats'],
      queryFn: () => api.get<SeatMapResponse>(`/shows/${id}/seats`),
      refetchInterval: SEAT_POLL_MS,
    }),
  snacks: () =>
    queryOptions({ queryKey: ['snacks'], queryFn: () => api.get<{ snacks: Snack[] }>('/snacks').then((r) => r.snacks), staleTime: 5 * 60_000 }),
  bookings: () => queryOptions({ queryKey: ['bookings'], queryFn: () => api.get<{ bookings: Booking[] }>('/bookings').then((r) => r.bookings) }),
  booking: (id: string) =>
    queryOptions({ queryKey: ['bookings', id], queryFn: () => api.get<{ booking: Booking }>(`/bookings/${id}`).then((r) => r.booking) }),
  adminShows: () =>
    queryOptions({ queryKey: ['admin', 'shows'], queryFn: () => api.get<{ shows: AdminShow[] }>('/admin/shows').then((r) => r.shows) }),
  adminShowBookings: (id: number) =>
    queryOptions({
      queryKey: ['admin', 'shows', id, 'bookings'],
      queryFn: () => api.get<{ bookings: AdminBooking[] }>(`/admin/shows/${id}/bookings`).then((r) => r.bookings),
    }),
}
