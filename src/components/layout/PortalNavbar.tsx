import { Link, useNavigate } from 'react-router-dom'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
import { GabahMarkIcon } from '@/components/ui/icons'
import { useAuth } from '@/features/auth/AuthContext'

/** Shared control height with AppTopbar (bell + user chip + logout). */
const CTRL =
  'inline-flex h-10 items-center justify-center rounded-xl border border-line bg-panel text-[13px] font-medium text-ink transition hover:border-brand-300 hover:bg-brand-50/50'

export function PortalNavbar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel shadow-[0_1px_0_rgba(20,32,25,0.04)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/portal"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-ink"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-800 text-white">
            <GabahMarkIcon className="size-5" />
          </span>
          <span className="text-[15px]">E-Gabah</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <UserMenu />
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            className={[CTRL, 'px-3.5'].join(' ')}
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  )
}
