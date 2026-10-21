import { Suspense, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useLogout } from '../auth/useAuth'
import { Icon, type IconName } from './Icon'
import { SmoothScroll } from './SmoothScroll'
import { PageLoader } from './ui'

function Search() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/')
  }
  return (
    <form className="search" role="search" onSubmit={submit}>
      <span className="search-icon">
        <Icon name="search" size={17} />
      </span>
      <input type="search" aria-label="Search movies" placeholder="Search by title, language or genre" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  )
}

function RailLink({ to, icon, label, end }: { to: string; icon: IconName; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="rail-link" aria-label={label}>
      <Icon name={icon} />
      <span className="tip">{label}</span>
    </NavLink>
  )
}

export function Layout() {
  const { user } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <SmoothScroll>
      <div className="wallpaper" aria-hidden />
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav className="rail" aria-label="Main">
        <RailLink to="/" end icon="home" label="Movies" />
        {user && <RailLink to="/bookings" icon="ticket" label="My bookings" />}
        {user?.role === 'admin' && <RailLink to="/admin" icon="grid" label="Admin" />}
        <span className="rail-sep" aria-hidden />
        {user ? (
          <button
            className="rail-link"
            aria-label="Log out"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
          >
            <Icon name="logout" />
            <span className="tip">Log out</span>
          </button>
        ) : (
          <RailLink to="/login" icon="login" label="Log in" />
        )}
      </nav>

      <div className="shell">
        <header className="topbar container">
          <div className="topbar-inner">
            <Link to="/" className="brand">
              <span className="brand-mark" aria-hidden />
              Yozigo
            </Link>
            <Search />
            <div className="nav-user">
              {user ? (
                <>
                  <span className="xsmall muted">{user.name.split(' ')[0]}</span>
                  <span className="avatar" title={user.email} aria-hidden>
                    {user.name.charAt(0).toUpperCase()}
                  </span>
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

        <main id="main">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>

        <footer className="footer container">
          <div className="footer-inner">
            <span className="brand">
              <span className="brand-mark" aria-hidden />
              Yozigo
            </span>
            <span>Screen 1 · 80 seats · Snacks delivered to your seat · Free cancellation up to 2 hours before</span>
          </div>
        </footer>
      </div>
    </SmoothScroll>
  )
}
