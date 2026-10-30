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
import {
  authUserFromProfile,
  loadProfileByUserId,
  mapSupabaseError,
} from '@/features/master/master-cloud'
import { readAppSettings } from '@/features/settings/app-settings'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase-client'
import { flushPendingRelationalSaves } from '@/lib/cloud-relational'
import type { AuthUser } from '@/types/auth'

type LoginInput = {
  email: string
  password: string
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
    void flushPendingRelationalSaves().finally(() => {
      clearStoredUser()
      setUser(null)
      if (isSupabaseConfigured()) {
        void getSupabase()?.auth.signOut()
      }
    })
  }, [])

  const login = useCallback(
    async ({ email, password, remember = true }: LoginInput) => {
      if (!email.trim() || !password.trim()) {
        throw new Error('Email dan kata sandi wajib diisi.')
      }

      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error } = await sb.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error || !data.user) {
          throw new Error(error?.message ?? 'Gagal masuk.')
        }
        let profile
        try {
          profile = await loadProfileByUserId(data.user.id)
        } catch (e) {
          await sb.auth.signOut()
          throw new Error(mapSupabaseError(e))
        }
        if (!profile.active) {
          await sb.auth.signOut()
          throw new Error('Akun nonaktif. Hubungi admin.')
        }
        const nextUser = authUserFromProfile(profile)
        saveStoredUser(nextUser, remember)
        setUser(nextUser)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 280))

      const account = findDemoAccount(email, password)
      if (!account) {
        throw new Error(
          'Email atau kata sandi salah. Coba admin@egabah.local / demo123',
        )
      }

      const nextUser = toAuthUser(account)
      saveStoredUser(nextUser, remember)
      setUser(nextUser)
    },
    [],
  )

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const sb = getSupabase()
    if (!sb) return
    let cancelled = false

    async function syncFromSession(uid: string | undefined) {
      if (!uid) {
        clearStoredUser()
        if (!cancelled) setUser(null)
        return
      }
      try {
        const profile = await loadProfileByUserId(uid)
        if (cancelled) return
        if (!profile.active) {
          clearStoredUser()
          setUser(null)
          await sb!.auth.signOut()
          return
        }
        const next = authUserFromProfile(profile)
        saveStoredUser(next, true)
        setUser(next)
      } catch {
        clearStoredUser()
        if (!cancelled) setUser(null)
      }
    }

    void (async () => {
      const { data } = await sb.auth.getSession()
      await syncFromSession(data.session?.user?.id)
    })()

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Return before any Supabase call. Awaiting inside this callback
        // deadlocks the auth lock; flush, then clear, on a later turn.
        window.setTimeout(() => {
          void flushPendingRelationalSaves().finally(() => {
            clearStoredUser()
            if (!cancelled) setUser(null)
          })
        }, 0)
        return
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        void syncFromSession(session?.user?.id)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
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
