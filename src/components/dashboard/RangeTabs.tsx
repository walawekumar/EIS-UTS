import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDownIcon } from '@/components/ui/icons'

type RangeTabsProps = {
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
}

export function RangeTabs({ value, options, onChange }: RangeTabsProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = options.find((opt) => opt.id === value) ?? options[0]

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
    <div ref={rootRef} className="relative shrink-0">
      <label htmlFor={id} className="sr-only">
        Rentang waktu
      </label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex h-9 min-w-[5.5rem] items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left font-mono text-[12px] transition',
          open
            ? 'border-brand-600 ring-2 ring-brand-100'
            : 'border-line hover:border-brand-300',
        ].join(' ')}
      >
        <span className="font-medium text-ink">{selected?.label ?? 'Pilih'}</span>
        <ChevronDownIcon
          className={['size-3.5 shrink-0 text-muted transition', open ? 'rotate-180' : ''].join(
            ' ',
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1.5 min-w-full overflow-hidden rounded-xl border border-line bg-white py-1 shadow-md"
        >
          {options.map((opt) => {
            const active = opt.id === value
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                }}
                className={[
                  'block w-full px-3 py-2 text-left font-mono text-[12px] transition',
                  active
                    ? 'bg-brand-50 font-semibold text-brand-900'
                    : 'text-ink hover:bg-brand-50/70',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
