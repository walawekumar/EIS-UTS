import { NavLink, useNavigate } from 'react-router-dom'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
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
        <NavLink
          to="/portal"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-ink"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-800 text-sm font-bold text-white">
            EG
          </span>
          <span className="text-[15px]">Portal</span>
        </NavLink>

        <nav className="ml-1 hidden items-center md:flex">
          <NavLink
            to="/portal"
            end
            className={({ isActive }) =>
              [
                'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition',
                isActive
                  ? 'bg-brand-100 text-brand-900'
                  : 'text-muted hover:bg-brand-50 hover:text-ink',
              ].join(' ')
            }
          >
            Beranda
          </NavLink>
        </nav>

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
