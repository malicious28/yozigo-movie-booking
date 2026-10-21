import { lazy } from 'react'
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from './auth/guards'
import { Layout } from './components/Layout'
import { EmptyState } from './components/ui'
import { BookingPage } from './pages/BookingPage'
import { HomePage } from './pages/HomePage'
import { LoginPage, SignupPage } from './pages/AuthPages'
import { MoviePage } from './pages/MoviePage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { ShowPage } from './pages/ShowPage'

// Admin pages are split into their own chunk: customers never download them.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminShowsPage = lazy(() => import('./pages/admin/AdminShowsPage'))
const AdminMoviesPage = lazy(() => import('./pages/admin/AdminMoviesPage'))
const AdminShowPage = lazy(() => import('./pages/admin/AdminShowPage'))

// Keyed by show ID so switching show time starts a fresh checkout (no seats/snacks carried over).
function ShowRoute() {
  return <ShowPage key={useParams().id} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="movies/:id" element={<MoviePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="shows/:id" element={<RequireAuth><ShowRoute /></RequireAuth>} />
          <Route path="bookings" element={<RequireAuth><MyBookingsPage /></RequireAuth>} />
          <Route path="bookings/:id" element={<RequireAuth><BookingPage /></RequireAuth>} />
          <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminShowsPage />} />
            <Route path="movies" element={<AdminMoviesPage />} />
            <Route path="shows/:id" element={<AdminShowPage />} />
          </Route>
          <Route path="*" element={<div className="container main"><EmptyState title="Page not found" /></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
