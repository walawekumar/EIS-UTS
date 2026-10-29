import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { canAccessPath } from '@/features/nav/nav-config'

export function RequireRole() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!canAccessPath(user.role, location.pathname)) {
    return <Navigate to="/app/dashboard" replace />
  }

  return <Outlet />
}
