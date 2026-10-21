import { Suspense, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useLogout } from '../auth/useAuth'
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
      <span className="search-icon" aria-hidden>
        ⌕
      </span>
      <input type="search" aria-label="Search movies" placeholder="Search movies, languages, genres" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  )
}

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
          <Search />
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
                <span className="avatar" title={user.email} aria-hidden>
                  {user.name.charAt(0).toUpperCase()}
                </span>
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
      <main id="main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>© Yozigo Cinema · Screen 1 · 80 seats</span>
          <span>Snacks delivered to your seat · Free cancellation up to 2 hours before the show</span>
        </div>
      </footer>
    </>
  )
}
