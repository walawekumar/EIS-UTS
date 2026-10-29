import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

export function PortalNavbar() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-brand-800 text-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <NavLink to="/portal" className="flex items-center gap-2.5 font-semibold tracking-wide">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-white/15 text-sm font-bold">
            EG
          </span>
          <span>E-Gabah</span>
        </NavLink>

        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink
            to="/portal"
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-1.5 text-sm transition',
                isActive ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            Portal
          </NavLink>
          <NavLink
            to="/app/dashboard"
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-1.5 text-sm transition',
                isActive ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            Dashboard
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right text-xs leading-tight sm:block">
            <p className="font-medium text-white">{user?.name}</p>
            <p className="text-white/70">{user?.roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-medium text-white/95 transition hover:bg-white/10"
          >
            Keluar
          </button>
          <div
            className="flex size-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold"
            aria-hidden
          >
            {user?.name?.charAt(0) ?? 'U'}
          </div>
        </div>
      </div>
    </header>
  )
}
