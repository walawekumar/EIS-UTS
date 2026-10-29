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
        <main className="scrollbar-none flex-1 overflow-y-auto px-5 py-4">
          <header className="mb-4 border-b border-line pb-3">
            <h1 className="text-[22px] leading-none font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p>
            ) : null}
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
