import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import type { UserRole } from '@/types/auth'

type RequireAnyRoleProps = {
  roles: UserRole[]
  fallback?: string
}

/** Izinkan outlet hanya jika role user termasuk daftar. */
export function RequireAnyRole({
  roles,
  fallback = '/portal',
}: RequireAnyRoleProps) {
  const { user } = useAuth()
  if (!user) return null
  if (!roles.includes(user.role)) {
    return <Navigate to={fallback} replace />
  }
  return <Outlet />
}
