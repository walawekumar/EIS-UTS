import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { sectionLabel } from '@/components/pembelian/Toolbar'

type DrawerShellProps = {
  open: boolean
  eyebrow: string
  title: string
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  children: ReactNode
  footer: ReactNode
}

/** Panel form yang muncul dari kanan. */
export function DrawerShell({ open, eyebrow, title, onClose, onSubmit, children, footer }: DrawerShellProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    function onEscape(event: KeyboardEvent) {
      // Select menutup dirinya sendiri lebih dulu
      if (event.key === 'Escape' && !document.querySelector('[role="listbox"]')) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 backdrop-blur-[1px]"
      />
      <form
        onSubmit={onSubmit}
        noValidate
        className="relative m-0 flex h-full w-full max-w-[460px] flex-col bg-panel shadow-[0_0_48px_rgba(20,32,25,0.18)] sm:m-2 sm:h-[calc(100%-1rem)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className={sectionLabel}>{eyebrow}</p>
            <h2 className="tabular-nums mt-1 truncate text-[15px] font-semibold text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
            aria-label="Tutup form"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="scrollbar-none flex-1 space-y-6 overflow-y-auto px-5 py-5">{children}</div>

        <footer className="border-t border-line px-5 py-4">{footer}</footer>
      </form>
    </div>
  )
}
