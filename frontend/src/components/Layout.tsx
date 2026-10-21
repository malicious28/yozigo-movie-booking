import { Suspense } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, useLogout } from '../auth/useAuth'
import { PageLoader } from './ui'

export function Layout() {
  const { user } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden>
              ▶
            </span>
            Yozigo Cinema
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>
              Movies
            </NavLink>
            {user && <NavLink to="/bookings">My bookings</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          </nav>
          <div className="nav-user">
            {user ? (
              <>
                <span className="muted">Hi, {user.name.split(' ')[0]}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Log in
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="container main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  )
}
