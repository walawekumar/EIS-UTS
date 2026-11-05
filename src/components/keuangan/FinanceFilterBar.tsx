import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDownIcon } from '@/components/ui/icons'

export type FilterOption<T extends string> = {
  value: T
  label: string
}

type FinanceFilterBarProps<T extends string, S extends string = never> = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filter: T
  filterOptions: readonly FilterOption<T>[]
  onFilterChange: (value: T) => void
  filterLabel?: string
  secondaryFilter?: S
  secondaryFilterOptions?: readonly FilterOption<S>[]
  onSecondaryFilterChange?: (value: S) => void
  secondaryFilterLabel?: string
  dateFrom?: string
  dateTo?: string
  onDateFromChange?: (value: string) => void
  onDateToChange?: (value: string) => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  actionLabel?: string
  onAction?: () => void
}

function useDismissible(open: boolean, setOpen: (open: boolean) => void) {
  const rootRef = useRef<HTMLDivElement>(null)

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
  }, [open, setOpen])

  return rootRef
}

function formatDateShort(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  }).format(d)
}

function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly FilterOption<T>[]
  onChange: (value: T) => void
  label: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useDismissible(open, setOpen)
  const selected = options.find((o) => o.value === value) ?? options[0]

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-panel px-3 text-left text-[13px] transition',
          open
            ? 'border-brand-600 ring-2 ring-brand-100'
            : 'border-line hover:border-brand-300',
        ].join(' ')}
      >
        <span className="truncate text-ink">{selected.label}</span>
        <ChevronDownIcon
          className={[
            'size-3.5 shrink-0 text-muted transition',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-md"
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={[
                  'block w-full px-3 py-2 text-left text-[13px] transition',
                  active
                    ? 'bg-brand-50 font-medium text-brand-900'
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

function DateRangeDropdown({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useDismissible(open, setOpen)
  const active = Boolean(dateFrom || dateTo)
  const summary = active
    ? [formatDateShort(dateFrom) || '…', formatDateShort(dateTo) || '…'].join(
        ' – ',
      )
    : 'Tanggal'

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-panel px-3 text-left text-[13px] transition',
          open || active
            ? 'border-brand-600 ring-2 ring-brand-100'
            : 'border-line hover:border-brand-300',
        ].join(' ')}
      >
        <span className={active ? 'truncate font-medium text-brand-900' : 'truncate text-ink'}>
          {summary}
        </span>
        <ChevronDownIcon
          className={[
            'size-3.5 shrink-0 text-muted transition',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter tanggal"
          className="absolute right-0 z-20 mt-1.5 w-[min(100vw-2rem,15.5rem)] rounded-xl border border-line bg-panel p-2.5 shadow-md"
        >
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted uppercase">
                Dari
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-line bg-panel px-2.5 text-[13px] text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted uppercase">
                Sampai
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-line bg-panel px-2.5 text-[13px] text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            {active ? (
              <button
                type="button"
                onClick={() => {
                  onDateFromChange('')
                  onDateToChange('')
                }}
                className="h-8 w-full rounded-xl text-[12px] font-medium text-muted transition hover:bg-brand-50 hover:text-ink"
              >
                Reset tanggal
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function FinanceFilterBar<T extends string, S extends string = never>({
  search,
  onSearchChange,
  searchPlaceholder = 'Cari…',
  filter,
  filterOptions,
  onFilterChange,
  filterLabel = 'Filter',
  secondaryFilter,
  secondaryFilterOptions,
  onSecondaryFilterChange,
  secondaryFilterLabel = 'Filter sekunder',
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  secondaryActionLabel,
  onSecondaryAction,
  actionLabel,
  onAction,
}: FinanceFilterBarProps<T, S>) {
  const hasSecondary =
    secondaryFilter !== undefined &&
    secondaryFilterOptions &&
    onSecondaryFilterChange
  const hasDates = Boolean(onDateFromChange && onDateToChange)

  return (
    <div className="mb-3 flex flex-col gap-2 lg:mb-3.5 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative block min-w-0 w-full flex-1 basis-[12rem]">
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
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-line bg-surface/40 py-2 pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-muted/70 transition focus:border-brand-600 focus:bg-panel focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div
          className={[
            'grid w-full gap-2',
            hasDates || hasSecondary
              ? 'grid-cols-2 sm:grid-cols-2 md:flex md:w-auto md:flex-wrap md:items-center'
              : 'grid-cols-1 sm:w-auto md:flex',
          ].join(' ')}
        >
          <div className="min-w-0 md:w-[11rem]">
            <FilterDropdown
              value={filter}
              options={filterOptions}
              onChange={onFilterChange}
              label={filterLabel}
            />
          </div>

          {hasSecondary ? (
            <div className="min-w-0 md:w-[11rem]">
              <FilterDropdown
                value={secondaryFilter}
                options={secondaryFilterOptions}
                onChange={onSecondaryFilterChange}
                label={secondaryFilterLabel}
              />
            </div>
          ) : null}

          {hasDates ? (
            <div className="col-span-2 min-w-0 md:col-span-1 md:w-[11rem]">
              <DateRangeDropdown
                dateFrom={dateFrom ?? ''}
                dateTo={dateTo ?? ''}
                onDateFromChange={onDateFromChange!}
                onDateToChange={onDateToChange!}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:justify-end lg:w-auto">
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-line px-4 text-[13px] font-medium text-ink transition hover:bg-brand-50 sm:w-auto"
          >
            {secondaryActionLabel}
          </button>
        ) : null}
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-800 px-4 text-[13px] font-semibold text-white transition hover:bg-brand-900 sm:w-auto"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
