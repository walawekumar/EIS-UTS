import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { ChevronDownIcon } from '@/components/ui/icons'

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  if (!user) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-line bg-panel px-2 py-1 text-left transition hover:bg-surface"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex size-7 items-center justify-center bg-brand-800 font-mono text-xs font-medium text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[13px] font-medium text-ink">{user.name}</span>
          <span className="block text-[11px] text-muted">{user.roleLabel}</span>
        </span>
        <ChevronDownIcon
          className={['size-3.5 text-muted transition', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-44 border border-line bg-panel py-1 shadow-sm"
        >
          <Link
            to="/app/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink hover:bg-surface"
          >
            Pengaturan
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
              navigate('/login', { replace: true })
            }}
            className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-surface"
          >
            Keluar
          </button>
        </div>
      ) : null}
    </div>
  )
}
