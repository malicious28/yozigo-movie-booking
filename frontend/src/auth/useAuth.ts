import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { queries } from '../api/queries'
import type { User } from '../api/types'

// The logged-in user is just the cached result of GET /auth/me (null when logged out).
export function useAuth() {
  const { data, isPending } = useQuery(queries.me())
  return { user: data ?? null, isLoading: isPending }
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api.post<{ user: User }>('/auth/login', body),
    onSuccess: ({ user }) => qc.setQueryData(queries.me().queryKey, user),
  })
}

export function useSignup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string }) => api.post<{ user: User }>('/auth/signup', body),
    onSuccess: ({ user }) => qc.setQueryData(queries.me().queryKey, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    // Drop everything cached for this user so the next person on this browser sees none of it.
    onSuccess: () => {
      qc.clear()
      qc.setQueryData(queries.me().queryKey, null)
    },
  })
}
