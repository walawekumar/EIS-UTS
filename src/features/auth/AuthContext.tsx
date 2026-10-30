import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearStoredUser,
  getLastActivity,
  loadStoredUser,
  saveStoredUser,
  touchActivity,
} from '@/lib/auth-storage'
import { findDemoAccount, toAuthUser } from '@/features/auth/demo-users'
import { readAppSettings } from '@/features/settings/app-settings'
import type { AuthUser, UserRole } from '@/types/auth'

type LoginInput = {
  email: string
  password: string
  role: UserRole
  remember?: boolean
}

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function timeoutMs(value: string): number | null {
  if (value === 'never') return null
  const n = Number(value)
  return Number.isFinite(n) ? n * 60_000 : 60 * 60_000
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadStoredUser())

  const logout = useCallback(() => {
    clearStoredUser()
    setUser(null)
  }, [])

  const login = useCallback(async ({ email, password, role, remember = true }: LoginInput) => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email dan kata sandi wajib diisi.')
    }

    await new Promise((resolve) => setTimeout(resolve, 280))

    const account = findDemoAccount(email, password)
    if (!account) {
      throw new Error(
        'Email atau kata sandi salah. Coba admin@egabah.local / demo123',
      )
    }
    if (account.role !== role) {
      throw new Error(
        `Akun ini untuk peran ${account.role}. Pilih peran yang sesuai.`,
      )
    }

    const nextUser = toAuthUser(account)
    saveStoredUser(nextUser, remember)
    setUser(nextUser)
  }, [])

  useEffect(() => {
    if (!user) return

    const tick = () => {
      const settings = readAppSettings()
      const ms = timeoutMs(settings.security.sessionTimeout)
      if (ms == null) return
      if (Date.now() - getLastActivity() > ms) {
        logout()
      }
    }

    const onActivity = () => {
      if (user) touchActivity()
    }

    tick()
    const interval = window.setInterval(tick, 30_000)
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
    }
  }, [user, logout])

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
