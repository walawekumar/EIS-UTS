import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type DetailDrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  badge?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Panel detail dari kanan — konten penuh + footer aksi selalu terlihat. */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
}: DetailDrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-ink/35 transition-opacity"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-drawer-title"
        className="detail-drawer-panel relative flex h-full w-full max-w-md flex-col bg-panel shadow-[-16px_0_48px_rgba(20,32,25,0.18)]"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="detail-drawer-title"
                className="num truncate text-[16px] font-semibold tracking-tight text-ink"
              >
                {title}
              </h2>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-1 text-[12.5px] leading-snug text-muted">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-brand-50 hover:text-ink"
            aria-label="Tutup detail"
          >
            ×
          </button>
        </header>

        <div className="scrollbar-brand min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 border-t border-line bg-panel px-5 py-4">
            <div className="grid gap-2">{footer}</div>
          </footer>
        ) : null}
      </aside>

      <style>{`
        @keyframes detail-drawer-in {
          from { transform: translateX(100%); opacity: 0.85; }
          to { transform: translateX(0); opacity: 1; }
        }
        .detail-drawer-panel {
          animation: detail-drawer-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>
    </div>,
    document.body,
  )
}

export function DrawerSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

export function DrawerFacts({
  items,
}: {
  items: Array<[string, string] | false | null | undefined>
}) {
  const rows = items.filter(Boolean) as Array<[string, string]>
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5">
          <dt className="text-[11px] text-muted">{label}</dt>
          <dd className="num mt-1 truncate text-[13px] font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DrawerHero({
  label,
  amount,
  tone = 'default',
  hint,
}: {
  label: string
  amount: string
  tone?: 'default' | 'good' | 'warn' | 'danger'
  hint?: string
}) {
  const color =
    tone === 'good'
      ? 'text-brand-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-red-700'
          : 'text-ink'
  return (
    <div className="mb-4 rounded-2xl border border-line/80 bg-surface/80 px-3.5 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={['num mt-1.5 text-[22px] leading-none font-semibold tracking-tight', color].join(' ')}>
        {amount}
      </p>
      {hint ? <p className="num mt-2 text-[11px] text-muted">{hint}</p> : null}
    </div>
  )
}
