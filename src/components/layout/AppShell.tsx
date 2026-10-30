import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppTopbar } from '@/components/layout/AppTopbar'

type AppShellProps = {
  title: string
  subtitle?: string
}

export function AppShell({ title, subtitle }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function closeMobileNav() {
    setMobileNavOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={closeMobileNav}
        />
      ) : null}
      <AppSidebar mobileOpen={mobileNavOpen} onNavigate={closeMobileNav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          title="E-Gabah"
          mobileNavOpen={mobileNavOpen}
          onMenuToggle={() => setMobileNavOpen((open) => !open)}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3.5 sm:px-5">
          <header className="mb-3 shrink-0">
            <h1 className="text-[18px] leading-none font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{subtitle}</p>
            ) : null}
          </header>
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto pb-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
