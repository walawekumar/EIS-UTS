import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { getNavForRole } from '@/features/nav/nav-config'

export function AppSidebar() {
  const { user } = useAuth()
  const groups = user ? getNavForRole(user.role) : []

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-12 items-center gap-2 border-b border-line px-4">
        <span className="font-mono text-[13px] font-semibold tracking-tight text-ink">
          E-GABAH
        </span>
        <span className="text-[10px] tracking-wide text-muted uppercase">ERP</span>
      </div>

      <nav className="scrollbar-none flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.id} className="mb-5">
            {group.label ? (
              <p className="mb-1 px-2 text-[10px] font-medium tracking-[0.08em] text-muted uppercase">
                {group.label}
              </p>
            ) : null}
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      [
                        'block border-l-2 px-2.5 py-1.5 text-[13px] transition',
                        isActive
                          ? 'border-brand-800 bg-[#ecebe7] font-semibold text-ink'
                          : 'border-transparent font-normal text-[#3f3e3b] hover:bg-[#f0efeb]',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <p className="truncate text-[11px] text-muted">{user?.roleLabel}</p>
        <p className="truncate font-mono text-[11px] text-ink">{user?.id}</p>
      </div>
    </aside>
  )
}
