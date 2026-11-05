import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icons'

export const panelClass =
  'rounded-2xl border border-line/90 bg-panel shadow-[0_1px_2px_rgba(20,32,25,0.04)]'

/** Tinggi konten di bawah topbar + judul halaman. */
export const pageFillClass =
  'flex h-[calc(100dvh-7.75rem)] min-h-[28rem] flex-col gap-3'

/** Layout master–detail: isi sisa tinggi. */
export const splitLayoutClass =
  'flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch'

export const splitMainClass = [
  panelClass,
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-5',
].join(' ')

export const splitAsideClass = [
  panelClass,
  'flex w-full shrink-0 flex-col overflow-hidden lg:w-[min(100%,380px)]',
].join(' ')

/** Panel kanan, konten mengisi, aksi di bawah. */
export const splitAsideBodyClass =
  'scrollbar-brand flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5'

export const primaryBtn =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-800 px-4 text-[13px] font-semibold text-white transition hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50'

export const secondaryBtn =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-panel px-4 text-[13px] font-medium text-ink transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900'

export const sectionLabel =
  'text-[11px] font-medium tracking-[0.08em] text-muted uppercase'

/** Highlight baris terpilih, aksen kiri, tanpa wash penuh yang melelahkan. */
export const activeRowClass =
  'relative bg-brand-50/70 hover:bg-brand-50/70 after:absolute after:inset-y-1 after:left-0 after:w-[3px] after:rounded-full after:bg-brand-600'

export function PageIntro({
  title,
  description,
  count,
}: {
  title: string
  description: string
  count?: number
}) {
  return (
    <div className="mb-3.5 shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {typeof count === 'number' ? (
          <span className="num rounded-lg bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
            {count}
          </span>
        ) : null}
      </div>
      <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">{description}</p>
    </div>
  )
}

export function DetailHeader({
  eyebrow,
  title,
  subtitle,
  badge,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/80 pb-3">
      <div className="min-w-0">
        <p className={sectionLabel}>{eyebrow}</p>
        <h3 className="num mt-1.5 truncate text-[16px] font-semibold tracking-tight text-ink">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-[12.5px] leading-snug text-muted">{subtitle}</p>
        ) : null}
      </div>
      {badge ? <div className="shrink-0 pt-0.5">{badge}</div> : null}
    </div>
  )
}

export function HeroAmount({
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
  const amountTone =
    tone === 'good'
      ? 'text-brand-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-red-700'
          : 'text-ink'

  return (
    <div className="rounded-2xl bg-surface/90 px-3.5 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p
        className={[
          'num mt-1.5 text-[22px] leading-none font-semibold tracking-tight',
          amountTone,
        ].join(' ')}
      >
        {amount}
      </p>
      {hint ? <p className="num mt-2 text-[11px] text-muted">{hint}</p> : null}
    </div>
  )
}

export function FactList({
  items,
}: {
  items: Array<[string, string] | false | null | undefined>
}) {
  const rows = items.filter(Boolean) as Array<[string, string]>
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="rounded-xl border border-line/70 bg-white/60 px-3 py-2.5"
        >
          <dt className="text-[11px] text-muted">{label}</dt>
          <dd className="num mt-1 truncate text-[13px] font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-brand-100/80">
      <div
        className="h-full rounded-full bg-brand-600 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function SoftBanner({
  children,
  tone = 'brand',
  action,
}: {
  children: ReactNode
  tone?: 'brand' | 'warn' | 'neutral'
  action?: ReactNode
}) {
  const toneClass =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'neutral'
        ? 'border-line bg-surface text-ink'
        : 'border-brand-200 bg-brand-50 text-brand-900'

  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px]',
        toneClass,
      ].join(' ')}
    >
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  )
}

export function QueueGroup({
  title,
  hint,
  count,
  children,
}: {
  title: string
  hint?: string
  count: number
  children: ReactNode
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <div>
          <p className={sectionLabel}>{title}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
        </div>
        <span className="num rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted">
          {count}
        </span>
      </div>
      {count === 0 && hint ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[12px] text-muted">
          Kosong, {hint.toLowerCase()}.
        </p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </div>
  )
}

export function QueueItem({
  active,
  onClick,
  id,
  meta,
  title,
  subtitle,
  compact,
}: {
  active: boolean
  onClick: () => void
  id: string
  meta?: string
  title: string
  subtitle?: string
  compact?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          'relative w-full rounded-xl border px-3 text-left transition',
          compact ? 'py-2' : 'py-2.5',
          active
            ? 'border-brand-300 bg-brand-50 shadow-[inset_3px_0_0_0_var(--color-brand-600)]'
            : 'border-line/80 bg-white hover:border-brand-200 hover:bg-surface/70',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={[
              'num text-[12px]',
              active ? 'font-semibold text-brand-900' : 'text-muted',
            ].join(' ')}
          >
            {id}
          </span>
          {meta ? <span className="num text-[11px] text-muted">{meta}</span> : null}
        </div>
        <p className="mt-1 truncate text-[13px] font-medium text-ink">{title}</p>
        {!compact && subtitle ? (
          <p className="num mt-0.5 truncate text-[11px] text-muted">{subtitle}</p>
        ) : null}
      </button>
    </li>
  )
}

export function PartnerCard({
  active,
  onClick,
  name,
  amount,
  tone = 'default',
  progress,
  hint,
}: {
  active: boolean
  onClick: () => void
  name: string
  amount: string
  tone?: 'default' | 'good' | 'danger'
  progress: number
  hint: string
}) {
  const amountTone =
    tone === 'danger'
      ? 'text-red-700'
      : tone === 'good'
        ? 'text-brand-700'
        : 'text-ink'

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-w-[148px] flex-1 rounded-xl border px-3 py-2.5 text-left transition sm:min-w-[160px]',
        active
          ? 'border-brand-300 bg-brand-50 shadow-[inset_0_-2px_0_0_var(--color-brand-600)]'
          : 'border-line/80 bg-white hover:border-brand-200 hover:bg-surface/60',
      ].join(' ')}
    >
      <p className="truncate text-[12px] font-medium text-ink">{name}</p>
      <p className={['num mt-1.5 text-[15px] font-semibold', amountTone].join(' ')}>
        {amount}
      </p>
      <div className="mt-2">
        <ProgressBar value={progress} />
      </div>
      <p className="num mt-1.5 truncate text-[11px] text-muted">{hint}</p>
    </button>
  )
}

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
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
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
        className="h-10 w-full rounded-xl border border-line bg-surface/40 py-2 pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-muted/70 transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
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
              'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition',
              active
                ? 'bg-brand-800 text-white'
                : 'border border-line text-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900',
            ].join(' ')}
          >
            {opt.label}
            {typeof opt.count === 'number' ? (
              <span
                className={['num text-[10px]', active ? 'text-white/75' : 'text-muted/80'].join(
                  ' ',
                )}
              >
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
  tone?: string
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
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'ArrowDown'
        ? Math.min(items.length - 1, index + 1)
        : Math.max(0, index - 1)
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
          'inline-flex h-10 items-center gap-2 rounded-xl border bg-white pr-2.5 pl-3 text-[13px] transition',
          open ? 'border-brand-600 ring-2 ring-brand-100' : 'border-line hover:border-brand-300',
        ].join(' ')}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z" />
        </svg>
        <span className="hidden text-muted sm:inline">{label}:</span>
        <span className="font-medium whitespace-nowrap text-ink">{current?.label}</span>
        {typeof current?.count === 'number' ? (
          <span className="num rounded-md bg-brand-800 px-1.5 text-[10px] leading-4 text-white">
            {current.count}
          </span>
        ) : null}
        <ChevronDownIcon
          className={['size-4 text-muted transition', open ? 'rotate-180' : ''].join(' ')}
        />
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
                <span
                  className={['size-2 shrink-0 rounded-full', opt.tone ?? 'bg-line'].join(' ')}
                />
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
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-surface text-muted">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M8 6h11M8 12h11M8 18h7" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      </span>
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-[16rem] text-[12px] leading-relaxed text-muted">{hint}</p>
    </div>
  )
}
