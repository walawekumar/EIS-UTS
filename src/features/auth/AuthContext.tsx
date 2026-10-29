import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearStoredUser, loadStoredUser, saveStoredUser } from '@/lib/auth-storage'
import { ROLE_LABELS, type AuthUser, type UserRole } from '@/types/auth'

type LoginInput = {
  email: string
  password: string
  role: UserRole
}

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function buildDemoUser(email: string, role: UserRole): AuthUser {
  const local = email.split('@')[0] || 'pengguna'
  const name = local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

  return {
    id: `USR-${role.toUpperCase()}`,
    name: name || 'Pengguna E-Gabah',
    email,
    role,
    roleLabel: ROLE_LABELS[role],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadStoredUser())

  const login = useCallback(async ({ email, password, role }: LoginInput) => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email dan kata sandi wajib diisi.')
    }

    // Mock auth — diganti Supabase Auth nanti
    await new Promise((resolve) => setTimeout(resolve, 350))
    const nextUser = buildDemoUser(email.trim(), role)
    saveStoredUser(nextUser)
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    clearStoredUser()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider')
  }
  return ctx
}
