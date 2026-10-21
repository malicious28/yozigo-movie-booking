import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth, useLogin, useSignup } from '../auth/useAuth'
import type { ReactNode } from 'react'
import { Alert } from '../components/ui'
import { heroGlow } from '../lib/hue'

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="container main">
      <div className="auth-wrap">
        <aside className="auth-aside">
          <div className="band-glow" style={heroGlow('Yozigo Cinema')} />
          <span style={{ fontSize: '2.4rem', position: 'relative' }} aria-hidden>
            🎬
          </span>
          <h2 style={{ position: 'relative' }}>Your seat is waiting.</h2>
          <p style={{ position: 'relative' }}>
            Pick the perfect seat on a live map, add popcorn delivered right to it, and get your e-ticket in seconds.
          </p>
        </aside>
        <div className="card">{children}</div>
      </div>
    </div>
  )
}

// Only follow same-site paths after login, never an arbitrary URL (open-redirect protection).
function useReturnPath() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return { location, returnTo: from && from.startsWith('/') && !from.startsWith('//') ? from : '/' }
}
export function LoginPage() {
  const { user } = useAuth()
  const login = useLogin()
  const navigate = useNavigate()
  const { location, returnTo } = useReturnPath()
  const [form, setForm] = useState({ email: '', password: '' })

  if (user) return <Navigate to={returnTo} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate(form, { onSuccess: () => navigate(returnTo, { replace: true }) })
  }

  return (
    <AuthShell>
      <h1>Log in</h1>
      <p className="muted">Log in to book seats and see your bookings.</p>
      {login.isError && <Alert kind="error">{errorMessage(login.error)}</Alert>}
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button className="btn btn-primary btn-block" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted small">
        New here? <Link to="/signup" state={location.state}>Create an account</Link>
      </p>
    </AuthShell>
  )
}

export function SignupPage() {
  const { user } = useAuth()
  const signup = useSignup()
  const navigate = useNavigate()
  const { location, returnTo } = useReturnPath()
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  if (user) return <Navigate to={returnTo} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    signup.mutate(form, { onSuccess: () => navigate(returnTo, { replace: true }) })
  }

  return (
    <AuthShell>
      <h1>Create an account</h1>
      <p className="muted">Your bookings are saved to your account.</p>
      {signup.isError && <Alert kind="error">{errorMessage(signup.error)}</Alert>}
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Name</span>
          <input autoComplete="name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-describedby="pw-hint"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <small id="pw-hint" className="muted">
            At least 8 characters
          </small>
        </label>
        <button className="btn btn-primary btn-block" disabled={signup.isPending}>
          {signup.isPending ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="muted small">
        Already have an account? <Link to="/login" state={location.state}>Log in</Link>
      </p>
    </AuthShell>
  )
}
