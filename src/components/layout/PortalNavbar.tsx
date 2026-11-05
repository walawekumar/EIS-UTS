import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

function NavIcon({
  children,
  active,
}: {
  children: ReactNode
  active?: boolean
}) {
  return (
    <span
      className={[
        'inline-flex size-4 shrink-0 items-center justify-center',
        active ? 'opacity-100' : 'opacity-80',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

export function PortalNavbar() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-brand-800 text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex h-[56px] max-w-6xl items-center gap-4 px-4 sm:px-6">
        <NavLink
          to="/portal"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-wide"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-white/15 text-sm font-bold">
            EG
          </span>
          <span className="text-[15px]">E-Gabah</span>
        </NavLink>

        <nav className="ml-2 hidden items-center gap-0.5 md:flex">
          <NavLink
            to="/portal"
            end
            className={({ isActive }) =>
              [
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition',
                isActive
                  ? 'bg-white/15 font-medium text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon active={isActive}>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                </NavIcon>
                Portal
              </>
            )}
          </NavLink>

          <NavLink
            to="/app/dashboard"
            className={({ isActive }) =>
              [
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition',
                isActive
                  ? 'bg-white/15 font-medium text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon active={isActive}>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
                  </svg>
                </NavIcon>
                E-Gabah
              </>
            )}
          </NavLink>

          <NavLink
            to="/absensi"
            className={({ isActive }) =>
              [
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition',
                isActive
                  ? 'bg-white/15 font-medium text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon active={isActive}>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </NavIcon>
                E-Absensi
              </>
            )}
          </NavLink>

          <span className="inline-flex cursor-default items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white/55">
            <NavIcon>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 19.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" />
              </svg>
            </NavIcon>
            Profil
          </span>

          <span className="inline-flex cursor-default items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white/55">
            <NavIcon>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10.5V17M12 7.5h.01" />
              </svg>
            </NavIcon>
            Pusat Bantuan
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-[11px] text-white/65">{user?.roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10"
          >
            Keluar
          </button>
          <div
            className="flex size-9 items-center justify-center rounded-full bg-white/18 text-sm font-semibold ring-1 ring-white/25"
            title={user?.email}
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
        </div>
      </div>
    </header>
  )
}
