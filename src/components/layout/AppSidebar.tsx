import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { getNavForRole } from '@/features/nav/nav-config'
import { LeafMarkIcon } from '@/components/ui/icons'

type AppSidebarProps = {
  mobileOpen?: boolean
  onNavigate?: () => void
}

export function AppSidebar({ mobileOpen = false, onNavigate }: AppSidebarProps) {
  const { user } = useAuth()
  const location = useLocation()
  const groups = user ? getNavForRole(user.role) : []

  const activeGroupIds = useMemo(() => {
    const open = new Set<string>()
    for (const group of groups) {
      if (!group.label) continue
      if (group.items.some((item) => location.pathname.startsWith(item.path))) {
        open.add(group.id)
      }
    }
    return open
  }, [groups, location.pathname])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function isGroupOpen(groupId: string): boolean {
    if (expanded[groupId] != null) return expanded[groupId]
    return activeGroupIds.has(groupId)
  }

  return (
    <aside
      className={[
        'flex h-full w-[268px] shrink-0 flex-col border-r border-line bg-panel',
        'fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-800 text-white">
          <LeafMarkIcon className="size-5" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-semibold text-ink">E-Gabah</p>
          <p className="truncate text-[12px] text-muted">ERP Penggilingan</p>
        </div>
      </div>

      <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 py-3.5">
        {groups.map((group) => {
          const isTopLevel = !group.label
          const open = isTopLevel || isGroupOpen(group.id)

          return (
            <div key={group.id} className="mb-4">
              {group.label ? (
                <button
                  type="button"
                  className="mb-1.5 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[13px] font-semibold text-ink transition hover:bg-brand-50"
                  aria-expanded={open}
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [group.id]: !isGroupOpen(group.id),
                    }))
                  }
                >
                  <span>{group.label}</span>
                  <span className="text-[12px] text-muted">{open ? '−' : '+'}</span>
                </button>
              ) : null}

              <div
                className="motion-collapse"
                data-open={open ? 'true' : 'false'}
              >
                <div>
                  <ul
                    className={
                      isTopLevel
                        ? 'space-y-1'
                        : 'ml-2 space-y-1 border-l border-brand-100 pl-2'
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
                              'flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] transition',
                              isActive
                                ? 'bg-brand-100 font-semibold text-brand-900'
                                : 'font-medium text-ink/80 hover:bg-brand-50 hover:text-brand-900',
                            ].join(' ')
                          }
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="mx-2.5 mb-3.5 rounded-xl border border-brand-100 bg-brand-50/80 px-3.5 py-3">
        <p className="truncate text-[12px] text-muted">{user?.roleLabel}</p>
        <p className="truncate text-[12.5px] text-brand-900" title={user?.email}>
          {user?.email ?? user?.name}
        </p>
      </div>
    </aside>
  )
}
