import { isUserRole, ROLE_LABELS, type AuthUser } from '@/types/auth'

const LOCAL_KEY = 'egabah.auth.user'
const SESSION_KEY = 'egabah.auth.session'
const ACTIVITY_KEY = 'egabah.auth.activity'

export function loadStoredUser(): AuthUser | null {
  try {
    const raw =
      localStorage.getItem(LOCAL_KEY) ?? sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.email !== 'string' ||
      !isUserRole(parsed.role)
    ) {
      clearStoredUser()
      return null
    }
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      roleLabel: ROLE_LABELS[parsed.role],
    }
  } catch {
    return null
  }
}

export function saveStoredUser(user: AuthUser, remember: boolean): void {
  const raw = JSON.stringify(user)
  clearStoredUser()
  if (remember) {
    localStorage.setItem(LOCAL_KEY, raw)
  } else {
    sessionStorage.setItem(SESSION_KEY, raw)
  }
  touchActivity()
}

export function clearStoredUser(): void {
  localStorage.removeItem(LOCAL_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(ACTIVITY_KEY)
}

export function touchActivity(): void {
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
}

export function getLastActivity(): number {
  const raw = localStorage.getItem(ACTIVITY_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : Date.now()
}
