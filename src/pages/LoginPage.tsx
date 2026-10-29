import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABELS, type UserRole } from '@/types/auth'

const ROLES = Object.keys(ROLE_LABELS) as UserRole[]

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@egabah.local')
  const [password, setPassword] = useState('demo123')
  const [role, setRole] = useState<UserRole>('admin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/portal" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ email, password, role })
      navigate('/portal', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(45,138,86,0.45), transparent 42%), radial-gradient(circle at 85% 10%, rgba(31,92,59,0.35), transparent 35%), linear-gradient(160deg, #0c1f14 0%, #123524 45%, #1a4d32 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md bg-brand-500/30 text-lg font-bold tracking-wide ring-1 ring-brand-300/30">
            EG
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">E-Gabah</h1>
          <p className="mt-2 text-sm text-brand-200">
            ERP Penggilingan Padi — akses terpusat modul usaha
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-white/10 bg-white/95 p-6 shadow-xl shadow-black/20 backdrop-blur"
        >
          <h2 className="text-lg font-semibold text-ink">Masuk ke sistem</h2>
          <p className="mt-1 text-sm text-muted">
            Autentikasi sementara (mock). Nanti diganti Supabase Auth.
          </p>

          <label className="mt-5 block text-sm font-medium text-ink">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              autoComplete="username"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-ink">
            Kata sandi
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              autoComplete="current-password"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-ink">
            Peran (RBAC demo)
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
