import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react'

/** Halaman operasi: scroll alami, tanpa kunci tinggi viewport. */
export function OpsPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1200px] space-y-4 pb-8">{children}</div>
}

export function OpsInsightStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{children}</div>
  )
}

export function OpsInsight({
  label,
  value,
  hint,
  tone = 'default',
  active,
  onClick,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'warn' | 'danger' | 'good'
  active?: boolean
  onClick?: () => void
}) {
  const valueTone =
    tone === 'warn'
      ? 'text-amber-700'
      : tone === 'danger'
        ? 'text-red-700'
        : tone === 'good'
          ? 'text-brand-700'
          : 'text-ink'

  const className = [
    'rounded-2xl border px-3.5 py-3 text-left transition',
    active
      ? 'border-brand-400 bg-brand-50 shadow-[inset_0_-2px_0_0_var(--color-brand-600)]'
      : 'border-line/80 bg-panel hover:border-brand-200',
    onClick ? 'cursor-pointer' : '',
  ].join(' ')

  const body = (
    <>
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={['num mt-1.5 text-[22px] leading-none font-semibold tracking-tight', valueTone].join(' ')}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 truncate text-[11px] text-muted">{hint}</p> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}

export function OpsPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-2xl border border-line/80 bg-panel p-4 shadow-[0_1px_2px_rgba(20,32,25,0.04)] sm:p-5',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </section>
  )
}

export function OpsPanelHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function OpsToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">{children}</div>
  )
}

export function OpsSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">Cari</span>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-surface/50 py-2 pr-3 pl-9 text-[13px] text-ink outline-none transition placeholder:text-muted/70 focus:border-brand-600 focus:bg-panel focus:ring-2 focus:ring-brand-100"
      />
    </label>
  )
}

export function OpsSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  const id = useId()
  return (
    <label className="relative block w-full shrink-0 sm:w-44">
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-full appearance-none rounded-xl border border-line bg-panel py-2 pr-9 pl-3 text-[13px] text-ink outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}

export function OpsPrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-800 px-4 text-[13px] font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function OpsSecondaryButton({
  children,
  onClick,
  disabled,
  danger,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        danger
          ? 'border-line text-red-700 hover:border-red-200 hover:bg-red-50'
          : 'border-line text-ink hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function OpsDocList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/80 bg-panel">{children}</ul>
}

export function OpsDocRow({
  active,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  trailing,
}: {
  active?: boolean
  onClick: () => void
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          'flex w-full items-center gap-3 px-4 py-3.5 text-left transition sm:gap-4 sm:px-5',
          active ? 'bg-brand-50/80' : 'hover:bg-surface/60',
        ].join(' ')}
      >
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={[
                'truncate text-[13px] font-semibold',
                active ? 'text-brand-900' : 'text-ink',
              ].join(' ')}
            >
              {title}
            </span>
            {meta}
          </div>
          {subtitle ? (
            <div className="mt-1 text-[12px] leading-snug text-muted">{subtitle}</div>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
      </button>
    </li>
  )
}

export function OpsEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
      <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-panel text-muted shadow-sm">
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
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">{hint}</p>
    </div>
  )
}

export function OpsFactGrid({
  items,
}: {
  items: Array<[string, string] | false | null | undefined>
}) {
  const rows = items.filter(Boolean) as Array<[string, string]>
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-surface/80 px-3 py-2.5">
          <dt className="text-[11px] text-muted">{label}</dt>
          <dd className="num mt-1 truncate text-[13px] font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function OpsProgress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
      <div
        className="h-full rounded-full bg-brand-600 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/**
 * Detail sheet: overlay kanan, scroll sendiri, footer aksi selalu di bawah sheet
 * (tidak terpotong oleh tinggi panel list).
 */
export function OpsSheet({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  badge?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-brand-950/25 backdrop-blur-[1px] transition"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ops-sheet-title"
        className="relative flex h-full w-full max-w-md flex-col bg-panel shadow-[-12px_0_40px_rgba(20,32,25,0.18)]"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line/80 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="ops-sheet-title"
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
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-ink"
            aria-label="Tutup detail"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="scrollbar-brand min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 border-t border-line/80 bg-panel px-5 py-4">
            <div className="grid gap-2">{footer}</div>
          </footer>
        ) : null}
      </div>
    </div>
  )
}

export function OpsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
      {children}
    </p>
  )
}

export function OpsQueueTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string; count: number }[]
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition',
              active
                ? 'bg-brand-800 text-white'
                : 'border border-line bg-panel text-ink hover:border-brand-300 hover:bg-brand-50',
            ].join(' ')}
          >
            {opt.label}
            <span
              className={[
                'num rounded-md px-1.5 text-[11px]',
                active ? 'bg-white/15 text-white' : 'bg-surface text-muted',
              ].join(' ')}
            >
              {opt.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
