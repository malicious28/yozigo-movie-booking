import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
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
    </>
  )
}
