import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="container main">
      <div className="admin-head">
        <div>
          <h1>Admin</h1>
          <p className="muted small">Manage what is playing and see how each show is selling.</p>
        </div>
        <nav className="tabs" aria-label="Admin sections">
          <NavLink to="/admin" end className="tab">
            Shows
          </NavLink>
          <NavLink to="/admin/movies" className="tab">
            Movies
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
