import { Link, Outlet } from 'react-router-dom'
import { PortalNavbar } from '@/components/layout/PortalNavbar'

type ModuleShellProps = {
  title: string
  subtitle: string
}

export function ModuleShell({ title, subtitle }: ModuleShellProps) {
  return (
    <div className="min-h-screen bg-surface">
      <PortalNavbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-brand-700">
              Modul E-Gabah
            </p>
            <h1 className="text-2xl font-semibold text-ink">{title}</h1>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
          <Link
            to="/portal"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-brand-800 transition hover:border-brand-300 hover:bg-brand-50"
          >
            Kembali ke Portal
          </Link>
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
