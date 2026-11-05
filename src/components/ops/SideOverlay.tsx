import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type SideOverlayProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Max width of the panel, e.g. max-w-md / max-w-lg */
  panelClassName?: string
  labelledBy?: string
}

/**
 * Full-viewport dim + right panel. Always portals to document.body so
 * AppShell overflow / motion transforms cannot clip the overlay.
 */
export function SideOverlay({
  open,
  onClose,
  children,
  panelClassName = 'max-w-md',
  labelledBy,
}: SideOverlayProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
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
        className="motion-backdrop absolute inset-0 bg-ink/35"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={[
          'motion-drawer relative flex h-full w-full flex-col bg-panel shadow-[-16px_0_48px_rgba(20,32,25,0.18)]',
          panelClassName,
        ].join(' ')}
      >
        {children}
      </aside>
    </div>,
    document.body,
  )
}
