import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { getNavForRole } from '@/features/nav/nav-config'
import { LeafMarkIcon } from '@/components/ui/icons'

export function AppSidebar() {
  const { user } = useAuth()
  const groups = user ? getNavForRole(user.role) : []

  return (
    <aside className="flex h-full w-[228px] shrink-0 flex-col border-r border-line bg-panel">
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
        {groups.map((group) => (
          <div key={group.id} className="mb-4">
            {group.label ? (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      [
                        'block rounded-lg px-2.5 py-2 text-[13px] transition',
                        isActive && item.children
                          ? 'font-semibold text-brand-900'
                          : isActive
                            ? 'bg-brand-100 font-semibold text-brand-900'
                            : 'font-medium text-ink/80 hover:bg-brand-50 hover:text-brand-900',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                  {item.children ? (
                    <ul className="mt-0.5 ml-3.5 space-y-0.5 border-l border-line pl-2">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <NavLink
                            to={child.path}
                            className={({ isActive }) =>
                              [
                                'block rounded-lg px-2.5 py-1.5 text-[12.5px] transition',
                                isActive
                                  ? 'bg-brand-100 font-semibold text-brand-900'
                                  : 'font-medium text-muted hover:bg-brand-50 hover:text-brand-900',
                              ].join(' ')
                            }
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-2.5 mb-3 rounded-xl border border-brand-100 bg-brand-50/80 px-3 py-2.5">
        <p className="truncate text-[11px] text-muted">{user?.roleLabel}</p>
        <p className="truncate font-mono text-[11px] text-brand-900">{user?.id}</p>
      </div>
    </aside>
  )
}
