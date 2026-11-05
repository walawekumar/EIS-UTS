import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'

export type SortDir = 'asc' | 'desc'

export type SortState<K extends string> = {
  key: K
  dir: SortDir
}

/** Klik 1: asc → klik 2: desc → klik 3: reset (null). */
export function toggleSort<K extends string>(
  current: SortState<K> | null,
  key: K,
): SortState<K> | null {
  if (current?.key === key) {
    if (current.dir === 'asc') return { key, dir: 'desc' }
    return null
  }
  return { key, dir: 'asc' }
}

export function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'id', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function sortBy<T, K extends string>(
  rows: T[],
  sort: SortState<K> | null,
  getters: Record<K, (row: T) => string | number>,
): T[] {
  if (!sort) return rows
  const get = getters[sort.key]
  if (!get) return rows
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => compareValues(get(left), get(right)) * dir)
}

export function FinanceTable({
  minWidth,
  children,
}: {
  /** Jika diisi, tabel bisa scroll horizontal. Tanpa ini tabel fluid 100%. */
  minWidth?: string
  children: ReactNode
}) {
  return (
    <div
      className={[
        'rounded-2xl border border-line/90 bg-panel',
        minWidth ? 'overflow-x-auto' : 'overflow-hidden',
      ].join(' ')}
    >
      <table
        className="w-full border-collapse text-left text-[13px] [&_th]:px-3.5 [&_th]:py-3 [&_td]:px-3.5 [&_td]:py-3"
        style={minWidth ? { minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  )
}

export function FinanceThead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line/80 bg-surface/70 text-[11px] tracking-wide text-muted uppercase">
        {children}
      </tr>
    </thead>
  )
}

export function FinanceTh({
  align = 'left',
  className,
  children,
  ...props
}: {
  align?: 'left' | 'right' | 'center'
  children: ReactNode
} & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={[
        'font-medium',
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : 'text-left',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      {children}
    </th>
  )
}

export function FinanceSortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
  className,
}: {
  label: string
  sortKey: K
  sort: SortState<K> | null
  onSort: (key: K) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const active = sort?.key === sortKey
  return (
    <th
      className={[
        'font-medium',
        align === 'right' ? 'text-right' : 'text-left',
        className ?? '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={[
          'inline-flex items-center gap-1 transition hover:text-ink',
          align === 'right' ? 'flex-row-reverse' : '',
          active ? 'text-ink' : 'text-muted',
        ].join(' ')}
        aria-sort={
          active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
      >
        <span>{label}</span>
        <SortIcon active={active} dir={active ? sort.dir : null} />
      </button>
    </th>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir | null }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      aria-hidden
      fill="currentColor"
    >
      <path
        d="M6 2.5 3.5 5.5h5L6 2.5Z"
        className={active && dir === 'asc' ? 'opacity-100' : 'opacity-30'}
      />
      <path
        d="M6 9.5 8.5 6.5h-5L6 9.5Z"
        className={active && dir === 'desc' ? 'opacity-100' : 'opacity-30'}
      />
    </svg>
  )
}

export function FinanceTr({
  children,
  onClick,
  className,
  active,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  active?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      className={[
        'border-b border-line/70 last:border-0 transition',
        onClick ? 'cursor-pointer hover:bg-surface/70' : '',
        active
          ? 'relative bg-brand-50/70 hover:bg-brand-50/70 after:absolute after:inset-y-1.5 after:left-0 after:w-[3px] after:rounded-full after:bg-brand-600'
          : '',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </tr>
  )
}

export function FinanceTd({
  align = 'left',
  mono,
  muted,
  className,
  children,
  ...props
}: {
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  muted?: boolean
  children: ReactNode
} & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={[
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : '',
        mono ? 'num' : '',
        muted ? 'text-muted' : 'text-ink',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      {children}
    </td>
  )
}

export function ActorCell({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-800">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="text-ink">{name}</span>
    </span>
  )
}

export function FinanceEmptyRow({
  colSpan,
  message,
  actionLabel,
  onAction,
}: {
  colSpan: number
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center">
        <p className="text-[13px] text-muted">{message}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-brand-800 px-4 text-[12px] font-semibold text-white transition hover:bg-brand-900"
          >
            {actionLabel}
          </button>
        ) : null}
      </td>
    </tr>
  )
}

/** Nomor baris global (ikut halaman pagination) */
export function rowNumber(page: number, pageSize: number, index: number) {
  return (page - 1) * pageSize + index + 1
}
