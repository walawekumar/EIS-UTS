import { useEffect, useRef, useState } from 'react'

const NOTIFICATIONS = [
  {
    id: '1',
    title: 'Penerimaan gabah menunggu konfirmasi',
    meta: 'RCV-0241 · 12 menit lalu',
    unread: true,
  },
  {
    id: '2',
    title: 'Batch BAT-0189 selesai QC',
    meta: 'Produksi · 1 jam lalu',
    unread: true,
  },
  {
    id: '3',
    title: 'Piutang DO-0912 jatuh tempo besok',
    meta: 'Keuangan · 3 jam lalu',
    unread: false,
  },
]

export function NotificationBell() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const unread = NOTIFICATIONS.filter((n) => n.unread).length

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'relative flex size-10 items-center justify-center rounded-xl border border-line bg-panel text-muted transition',
          'hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-800',
          open ? 'border-brand-300 bg-brand-50 text-brand-800' : '',
        ].join(' ')}
        aria-label="Notifikasi"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-brand-700 font-mono text-[9px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-panel shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-ink">Notifikasi</p>
            <span className="font-mono text-[11px] text-muted">{unread} baru</span>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {NOTIFICATIONS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-brand-50/80"
                >
                  <span
                    className={[
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      item.unread ? 'bg-brand-600' : 'bg-line',
                    ].join(' ')}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-snug font-medium text-ink">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted">
                      {item.meta}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-3.5 py-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-xl px-2 py-1.5 text-center text-[12px] font-medium text-brand-800 transition hover:bg-brand-50"
            >
              Lihat semua
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
