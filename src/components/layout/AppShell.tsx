import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppTopbar } from '@/components/layout/AppTopbar'

type AppShellProps = {
  title: string
  subtitle?: string
}

export function AppShell({ title, subtitle }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar title="E-Gabah" />
        <main className="scrollbar-none flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <header className="mb-2.5">
            <h1 className="text-[17px] leading-none font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[12px] text-muted">{subtitle}</p>
            ) : null}
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
