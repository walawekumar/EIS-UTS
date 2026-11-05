import { useMemo, useState } from 'react'
import { PortalNavbar } from '@/components/layout/PortalNavbar'
import { useAuth } from '@/features/auth/AuthContext'
import { rememberLaunchPath } from '@/lib/open-app-tab'
import type { UserRole } from '@/types/auth'

function greetingByHour(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat Pagi'
  if (hour < 15) return 'Selamat Siang'
  if (hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

type AppCategory = 'semua' | 'operasional' | 'sdm'

type PortalApp = {
  id: string
  title: string
  description: string
  path: string
  category: Exclude<AppCategory, 'semua'>
  icon: 'mill' | 'clock' | 'people'
  /** Jika diisi, hanya role ini yang melihat kartu di portal. */
  roles?: UserRole[]
}

const APPS: PortalApp[] = [
  {
    id: 'egabah',
    title: 'E-Gabah',
    description: 'ERP penggilingan: pembelian, produksi, stok, penjualan, keuangan',
    path: '/app/dashboard',
    category: 'operasional',
    icon: 'mill',
    roles: [
      'admin',
      'pembelian',
      'produksi',
      'gudang',
      'penjualan',
      'keuangan',
      'hr',
    ],
  },
  {
    id: 'eabsensi',
    title: 'E-Absensi',
    description: 'Check-in / check-out dan ajukan cuti / izin',
    path: '/absensi',
    category: 'sdm',
    icon: 'clock',
  },
  {
    id: 'ehr',
    title: 'E-HR',
    description: 'Persetujuan cuti, rekap SDM, roster, dan persiapan gaji',
    path: '/hr',
    category: 'sdm',
    icon: 'people',
    roles: ['admin', 'hr'],
  },
]

const FILTERS: { id: AppCategory; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'operasional', label: 'Operasional' },
  { id: 'sdm', label: 'SDM' },
]

function AppIcon({ kind }: { kind: PortalApp['icon'] }) {
  if (kind === 'clock') {
    return (
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'people') {
    return (
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M16 19v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1" strokeLinecap="round" />
        <circle cx="10" cy="8" r="3" />
        <path d="M20 19v-1a2.5 2.5 0 0 0-2-2.45" strokeLinecap="round" />
        <path d="M16 5.1a2.5 2.5 0 0 1 0 4.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="M6 19V9l3-2 3 2v10" strokeLinejoin="round" />
      <path d="M12 19V8l3-2 3 2v11" strokeLinejoin="round" />
      <path d="M9 12h.01M15 11h.01" strokeLinecap="round" />
    </svg>
  )
}

export function PortalPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<AppCategory>('semua')
  const [query, setQuery] = useState('')

  const accessible = useMemo(() => {
    const role = user?.role
    return APPS.filter((app) => {
      if (!app.roles?.length) return true
      return role ? app.roles.includes(role) : false
    })
  }, [user?.role])

  const visibleFilters = useMemo(() => {
    const cats = new Set(accessible.map((a) => a.category))
    return FILTERS.filter(
      (f) => f.id === 'semua' || cats.has(f.id as Exclude<AppCategory, 'semua'>),
    )
  }, [accessible])

  const activeFilter = visibleFilters.some((f) => f.id === filter)
    ? filter
    : 'semua'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accessible.filter((app) => {
      if (activeFilter !== 'semua' && app.category !== activeFilter) return false
      if (!q) return true
      return (
        app.title.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q)
      )
    })
  }, [accessible, activeFilter, query])

  const displayName = (user?.name ?? 'Pengguna').toUpperCase()

  return (
    <div className="min-h-screen bg-surface">
      <PortalNavbar />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-5 flex items-start gap-4 rounded-2xl border border-line bg-panel px-4 py-4 sm:px-5 sm:py-5">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-ink sm:text-[24px]">
              {greetingByHour()},{' '}
              <span className="text-brand-900">{displayName}</span>
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Anda login sebagai{' '}
              <span className="font-semibold text-ink">
                {user?.roleLabel ?? 'Pengguna'}
              </span>
              {user?.email ? <> ({user.email})</> : null}. Pilih aplikasi, dibuka di
              tab baru. Portal tetap di sini.
            </p>
          </div>
        </section>

        <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {visibleFilters.map((f) => {
              const active = activeFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={[
                    'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
                    active
                      ? 'bg-brand-800 text-white'
                      : 'bg-brand-100 text-brand-800 hover:bg-brand-200',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Pencarian</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l3.5 3.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pencarian"
              className="h-10 w-full rounded-xl border border-line bg-panel pl-9 pr-3 text-[13px] text-ink outline-none transition placeholder:text-muted focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </section>

        <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((app) => (
            <a
              key={app.id}
              href={app.path}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => rememberLaunchPath(app.path)}
              className="group flex flex-col items-center rounded-2xl border border-line bg-panel px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-brand-800 text-white">
                <AppIcon kind={app.icon} />
              </span>
              <h2 className="text-[15px] font-semibold text-ink group-hover:text-brand-900">
                {app.title}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted">
                {app.description}
              </p>
            </a>
          ))}
        </section>

        {filtered.length === 0 ? (
          <p className="mt-8 text-center text-[13px] text-muted">
            Tidak ada aplikasi yang cocok dengan pencarian.
          </p>
        ) : null}
      </main>
    </div>
  )
}
