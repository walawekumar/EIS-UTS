import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/PasswordField'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import { LeafMarkIcon, MailIcon, UserBadgeIcon } from '@/components/ui/icons'
import { useAuth } from '@/features/auth/AuthContext'
import { LoginPreview } from '@/pages/login/LoginPreview'
import { ROLE_LABELS, type UserRole } from '@/types/auth'

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
  description:
    value === 'admin'
      ? 'Akses penuh laporan dan master data'
      : value === 'pembelian'
        ? 'Pembelian dan penerimaan gabah'
        : value === 'produksi'
          ? 'Batch giling dan input-output'
          : value === 'gudang'
            ? 'Saldo stok dan koreksi'
            : value === 'penjualan'
              ? 'Order, kirim, dan tagihan'
              : 'Kas, utang, piutang, biaya',
}))

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@egabah.local')
  const [password, setPassword] = useState('demo123')
  const [role, setRole] = useState<UserRole>('admin')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ email, password, role })
      if (!remember) {
        // Session tetap disimpan untuk MVP mock; flag siap dipakai saat Supabase
      }
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#e8eee9]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 40% at 15% 10%, rgba(198,232,214,0.9), transparent 55%), radial-gradient(ellipse 50% 35% at 90% 80%, rgba(213,230,220,0.8), transparent 50%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1120px] items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full rounded-[18px] border border-white/70 bg-white shadow-[0_24px_60px_rgba(20,32,25,0.12)] lg:grid-cols-[0.92fr_1.08fr]">
          {/* Form */}
          <section className="flex flex-col justify-center rounded-[18px] px-6 py-9 sm:px-10 lg:rounded-l-[18px] lg:rounded-r-none lg:px-12 lg:py-12">
            <div className="mb-8 inline-flex items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-[10px] bg-brand-800 text-white">
                <LeafMarkIcon className="size-5" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-ink">
                E-Gabah
              </span>
            </div>

            <h1 className="font-display text-[1.85rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2rem]">
              Selamat datang di E-Gabah
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Masuk untuk membuka portal modul penggilingan padi.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <TextField
                id="login-email"
                label="Email"
                requiredMark
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@usaha.com"
                autoComplete="username"
                required
                leading={<MailIcon />}
              />

              <PasswordField
                id="login-password"
                label="Kata sandi"
                requiredMark
                value={password}
                onChange={setPassword}
                placeholder="Masukkan kata sandi"
                required
              />

              <Select
                id="login-role"
                label="Peran"
                requiredMark
                value={role}
                onChange={setRole}
                options={ROLE_OPTIONS}
                leading={<UserBadgeIcon />}
              />

              <div className="pt-1">
                <Switch
                  id="login-remember"
                  label="Ingat sesi masuk"
                  checked={remember}
                  onChange={setRemember}
                />
              </div>

              {error ? (
                <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <Button type="submit" loading={loading} className="mt-2">
                Masuk
              </Button>
            </form>

            <p className="mt-8 text-[11px] leading-relaxed text-muted/80">
              © {new Date().getFullYear()} E-Gabah · ERP Penggilingan Padi
            </p>
          </section>

          {/* Visual panel */}
          <aside className="hidden lg:block">
            <LoginPreview />
          </aside>
        </div>
      </div>
    </div>
  )
}
