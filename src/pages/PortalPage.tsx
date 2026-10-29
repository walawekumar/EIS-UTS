import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ModuleIcon } from '@/components/icons/ModuleIcons'
import { PortalNavbar } from '@/components/layout/PortalNavbar'
import { useAuth } from '@/features/auth/AuthContext'
import {
  APP_MODULES,
  MODULE_CATEGORIES,
  type ModuleCategory,
} from '@/features/portal/modules'

function greetingByHour(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat Pagi'
  if (hour < 15) return 'Selamat Siang'
  if (hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

export function PortalPage() {
  const { user } = useAuth()
  const [category, setCategory] = useState<ModuleCategory>('semua')
  const [query, setQuery] = useState('')

  const modules = useMemo(() => {
    const q = query.trim().toLowerCase()
    return APP_MODULES.filter((mod) => {
      const byCategory = category === 'semua' || mod.category === category
      const byQuery =
        !q ||
        mod.title.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q)
      return byCategory && byQuery
    })
  }, [category, query])

  return (
    <div className="min-h-screen bg-surface">
      <PortalNavbar />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-7">
        {/* Welcome banner — referensi portal SSO */}
        <section className="flex items-center gap-4 rounded-lg border border-line bg-white px-5 py-5 shadow-[0_2px_10px_rgba(20,32,25,0.04)] sm:gap-5 sm:px-6">
          <div className="relative flex size-14 shrink-0 items-center justify-center">
            <div
              className="absolute inset-0 bg-brand-100"
              style={{
                clipPath:
                  'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
              }}
            />
            <svg
              viewBox="0 0 24 24"
              className="relative size-6 text-brand-800"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {greetingByHour()}, {(user?.name ?? 'Pengguna').toUpperCase()}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Anda login sebagai {user?.roleLabel} ({user?.id})
            </p>
          </div>
        </section>

        {/* Filter + search */}
        <section className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {MODULE_CATEGORIES.map((item) => {
              const active = category === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={[
                    'rounded-md px-3.5 py-2 text-sm font-medium transition',
                    active
                      ? 'bg-brand-800 text-white shadow-sm'
                      : 'bg-brand-100 text-brand-900 hover:bg-brand-200',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <label className="relative block w-full shrink-0 lg:max-w-[260px]">
            <span className="sr-only">Pencarian modul</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pencarian"
              className="w-full rounded-md border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
            />
          </label>
        </section>

        {/* Module grid */}
        <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <Link
              key={mod.id}
              to={mod.path}
              className="group rounded-lg border border-line bg-white px-4 py-6 text-center shadow-[0_2px_8px_rgba(20,32,25,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_8px_20px_rgba(20,32,25,0.08)]"
            >
              <div
                className="mx-auto mb-4 flex size-[58px] items-center justify-center rounded-md text-white shadow-sm transition duration-200 group-hover:scale-[1.03]"
                style={{ backgroundColor: mod.accent }}
              >
                <ModuleIcon name={mod.icon} className="size-7" />
              </div>
              <h2 className="text-[15px] font-semibold text-ink group-hover:text-brand-800">
                {mod.title}
              </h2>
              <p className="mt-1.5 text-[13px] leading-snug text-muted">
                {mod.description}
              </p>
            </Link>
          ))}
        </section>

        {modules.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">
            Tidak ada modul yang cocok dengan pencarian.
          </p>
        ) : null}
      </main>
    </div>
  )
}
