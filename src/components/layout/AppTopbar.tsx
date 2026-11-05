import { NotificationBell } from '@/components/layout/NotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
import { MenuIcon } from '@/components/ui/icons'

function formatToday(date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

type AppTopbarProps = {
  title: string
  onMenuToggle?: () => void
  mobileNavOpen?: boolean
}

export function AppTopbar({ title, onMenuToggle, mobileNavOpen }: AppTopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {onMenuToggle ? (
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileNavOpen ?? false}
            onClick={onMenuToggle}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink transition hover:bg-brand-50 md:hidden"
          >
            <MenuIcon className="size-5" />
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="truncate text-[11px] text-muted capitalize">{formatToday()}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
