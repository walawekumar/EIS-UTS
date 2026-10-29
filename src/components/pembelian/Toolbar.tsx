import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icons'

export const panelClass = 'rounded-2xl border border-line bg-panel'

export const primaryBtn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50'

export const secondaryBtn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-panel px-3.5 text-[13px] font-medium text-ink transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900'

export const sectionLabel = 'text-[11px] font-medium tracking-[0.08em] text-muted uppercase'

export function SearchInput({
  value,
  onChange,
  placeholder,
  fullWidth = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  fullWidth?: boolean
}) {
  return (
    <div className={['relative min-w-0 flex-1', fullWidth ? '' : 'sm:max-w-xs'].join(' ')}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-xl border border-line bg-white py-2 pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-muted/70 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  )
}

export function FilterPills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string; count?: number }[]
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[12px] font-medium transition',
              active
                ? 'bg-brand-800 text-white'
                : 'border border-line text-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900',
            ].join(' ')}
          >
            {opt.label}
            {typeof opt.count === 'number' ? (
              <span className={['num text-[10px]', active ? 'text-white/75' : 'text-muted/80'].join(' ')}>
                {opt.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

type FilterOption<T extends string> = {
  id: T
  label: string
  count?: number
  tone?: string // kelas warna titik penanda
}

export function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
  label = 'Filter',
}: {
  value: T
  options: FilterOption<T>[]
  onChange: (id: T) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const current = options.find((opt) => opt.id === value)

  useEffect(() => {
    if (!open) return

    // Fokus ke opsi terpilih saat menu dibuka
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  function choose(id: T) {
    onChange(id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)
    items[next]?.focus()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={[
          'inline-flex h-9 items-center gap-2 rounded-xl border bg-white pr-2.5 pl-3 text-[13px] transition',
          open ? 'border-brand-600 ring-2 ring-brand-100' : 'border-line hover:border-brand-300',
        ].join(' ')}
      >
        <svg viewBox="0 0 24 24" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z" />
        </svg>
        <span className="hidden text-muted sm:inline">{label}:</span>
        <span className="font-medium whitespace-nowrap text-ink">{current?.label}</span>
        {typeof current?.count === 'number' ? (
          <span className="num rounded-md bg-brand-800 px-1.5 text-[10px] leading-4 text-white">{current.count}</span>
        ) : null}
        <ChevronDownIcon className={['size-4 text-muted transition', open ? 'rotate-180' : ''].join(' ')} />
      </button>

      {open ? (
        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          onKeyDown={onListKeyDown}
          className="absolute top-full right-0 z-30 mt-1.5 w-60 rounded-xl border border-line bg-white p-1 shadow-[0_16px_40px_rgba(20,32,25,0.16)]"
        >
          {options.map((opt) => {
            const selected = opt.id === value
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(opt.id)}
                className={[
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition',
                  'hover:bg-brand-50 focus-visible:bg-brand-50',
                  selected ? 'font-medium text-brand-900' : 'text-ink',
                ].join(' ')}
              >
                <span className={['size-2 shrink-0 rounded-full', opt.tone ?? 'bg-line'].join(' ')} />
                <span className="flex-1">{opt.label}</span>
                {typeof opt.count === 'number' ? (
                  <span className="num text-[11px] text-muted">{opt.count}</span>
                ) : null}
                <span className="flex size-4 items-center justify-center text-brand-700">
                  {selected ? <CheckIcon className="size-3.5" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[12px] text-muted">{hint}</p>
    </div>
  )
}
