import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AppTopbar } from '@/components/layout/AppTopbar'
import { useAuth } from '@/features/auth/AuthContext'
import { LeafMarkIcon } from '@/components/ui/icons'

export type ModuleNavItem = {
  to: string
  label: string
  end?: boolean
  roles?: Array<'admin' | 'hr' | 'keuangan'>
}

type ModuleShellProps = {
  appName: string
  appTagline: string
  title: string
  subtitle: string
  navItems: ModuleNavItem[]
  children?: ReactNode
}

/** Shell modul sibling E-Gabah — chrome sama dengan AppShell/AppSidebar. */
export function ModuleShell({
  appName,
  appTagline,
  title,
  subtitle,
  navItems,
}: ModuleShellProps) {
  const { user } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function closeMobileNav() {
    setMobileNavOpen(false)
  }

  const visible = navItems.filter((item) => {
    if (!item.roles?.length) return true
    return user?.role
      ? item.roles.includes(user.role as 'admin' | 'hr' | 'keuangan')
      : false
  })

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Tutup menu"
          className="motion-backdrop fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={closeMobileNav}
        />
      ) : null}

      <aside
        className={[
          'flex h-full w-[268px] shrink-0 flex-col border-r border-line bg-panel',
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-800 text-white">
            <LeafMarkIcon className="size-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-semibold text-ink">
              {appName}
            </p>
            <p className="truncate text-[12px] text-muted">{appTagline}</p>
          </div>
        </div>

        <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 py-3.5">
          <ul className="space-y-1">
            {visible.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={closeMobileNav}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] transition',
                      isActive
                        ? 'bg-brand-100 font-semibold text-brand-900'
                        : 'font-medium text-ink/80 hover:bg-brand-50 hover:text-brand-900',
                    ].join(' ')
                  }
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mx-2.5 mb-3.5 rounded-xl border border-brand-100 bg-brand-50/80 px-3.5 py-3">
          <p className="truncate text-[12px] text-muted">
            {user?.roleLabel ?? 'Pengguna'}
          </p>
          <p
            className="truncate text-[12.5px] text-brand-900"
            title={user?.email}
          >
            {user?.email ?? user?.name}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          title={appName}
          mobileNavOpen={mobileNavOpen}
          onMenuToggle={() => setMobileNavOpen((open) => !open)}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3.5 sm:px-5">
          <header className="mb-3.5 shrink-0">
            <h1 className="text-[20px] leading-none font-semibold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {subtitle}
            </p>
          </header>
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto pb-6">
            <div key={location.pathname} className="motion-page">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
