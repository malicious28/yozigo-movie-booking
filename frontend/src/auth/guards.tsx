import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageLoader } from '../components/ui'
import { useAuth } from './useAuth'

// Route guards. These are for user experience only: the API enforces the same rules itself.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}
