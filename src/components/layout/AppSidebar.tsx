import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { getNavForRole } from '@/features/nav/nav-config'
import { LeafMarkIcon } from '@/components/ui/icons'

type AppSidebarProps = {
  mobileOpen?: boolean
  onNavigate?: () => void
}

export function AppSidebar({ mobileOpen = false, onNavigate }: AppSidebarProps) {
  const { user } = useAuth()
  const groups = user ? getNavForRole(user.role) : []

  return (
    <aside
      className={[
        'flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-panel',
        'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-800 text-white">
          <LeafMarkIcon className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">E-Gabah</p>
          <p className="truncate text-[11px] text-muted">ERP Penggilingan</p>
        </div>
      </div>

      <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((group) => {
          const isTopLevel = !group.label

          return (
            <div key={group.id} className="mb-3.5">
              {group.label ? (
                <p className="mb-1 px-2.5 py-1 text-[12px] font-semibold text-ink">
                  {group.label}
                </p>
              ) : null}

              <ul
                className={
                  isTopLevel
                    ? 'space-y-0.5'
                    : 'ml-2 space-y-0.5 border-l border-brand-100 pl-2'
                }
              >
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      end={item.path.split('/').length <= 3}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition',
                          isActive
                            ? 'bg-brand-100 font-semibold text-brand-900'
                            : 'font-medium text-ink/75 hover:bg-brand-50 hover:text-brand-900',
                        ].join(' ')
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="mx-2.5 mb-3 rounded-xl border border-brand-100 bg-brand-50/80 px-3 py-2.5">
        <p className="truncate text-[11px] text-muted">{user?.roleLabel}</p>
        <p className="truncate font-mono text-[11px] text-brand-900">{user?.id}</p>
      </div>
    </aside>
  )
}
