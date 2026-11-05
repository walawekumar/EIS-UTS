import { Link } from 'react-router-dom'
import { PortalNavbar } from '@/components/layout/PortalNavbar'
import { useAuth } from '@/features/auth/AuthContext'

function greetingByHour(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

const APPS = [
  {
    id: 'egabah',
    title: 'E-Gabah',
    subtitle: 'ERP Penggilingan',
    description:
      'Pembelian, produksi, persediaan, penjualan, keuangan, dan laporan operasional.',
    path: '/app/dashboard',
    cta: 'Buka E-Gabah',
    accent: '#1a4d36',
  },
  {
    id: 'eabsensi',
    title: 'E-Absensi',
    subtitle: 'Kehadiran karyawan',
    description:
      'Check-in / check-out harian. Fondasi absensi terpisah dari modul ERP.',
    path: '/absensi',
    cta: 'Buka E-Absensi',
    accent: '#0f766e',
  },
] as const

export function PortalPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-surface">
      <PortalNavbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-8">
          <p className="text-[13px] font-medium text-brand-800">Portal aplikasi</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">
            {greetingByHour()}, {user?.name ?? 'Pengguna'}
          </h1>
          <p className="mt-2 max-w-xl text-[14px] text-muted">
            Pilih aplikasi. E-Gabah untuk operasional penggilingan; E-Absensi
            untuk kehadiran, dua aplikasi terpisah dari satu login.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {APPS.map((app) => (
            <Link
              key={app.id}
              to={app.path}
              className="group flex flex-col rounded-2xl border border-line bg-panel p-5 shadow-[0_1px_2px_rgba(20,32,25,0.04)] transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_10px_28px_rgba(20,32,25,0.08)] sm:p-6"
            >
              <div
                className="mb-4 flex size-12 items-center justify-center rounded-xl text-[15px] font-bold text-white"
                style={{ backgroundColor: app.accent }}
              >
                {app.id === 'egabah' ? 'EG' : 'EA'}
              </div>
              <h2 className="text-[18px] font-semibold text-ink group-hover:text-brand-900">
                {app.title}
              </h2>
              <p className="mt-0.5 text-[12px] font-medium text-brand-800">
                {app.subtitle}
              </p>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-muted">
                {app.description}
              </p>
              <span className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-brand-800 text-[13px] font-semibold text-white transition group-hover:bg-brand-900">
                {app.cta}
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
