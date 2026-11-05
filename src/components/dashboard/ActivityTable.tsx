import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, EyeIcon } from '@/components/ui/icons'
import type { ActivityRow } from '@/features/dashboard/dashboard-data'
import { usePageSize } from '@/features/settings/usePageSize'

const STATUS_LABEL = {
  ok: 'Selesai',
  warn: 'Proses',
  draft: 'Draft',
} as const

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua status' },
  { value: 'ok', label: 'Selesai' },
  { value: 'warn', label: 'Proses' },
  { value: 'draft', label: 'Draft' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

function rowKey(row: ActivityRow) {
  return `${row.reference}-${row.date}-${row.type}`
}

function getPageItems(current: number, total: number): Array<number | '…'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const items: Array<number | '…'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('…')
  for (let p = start; p <= end; p += 1) items.push(p)
  if (end < total - 1) items.push('…')
  items.push(total)
  return items
}

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: StatusFilter
  onChange: (value: StatusFilter) => void
}) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = STATUS_FILTERS.find((o) => o.value === value) ?? STATUS_FILTERS[0]

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
    <div ref={rootRef} className="relative w-full sm:w-44">
      <label htmlFor={id} className="sr-only">
        Filter status
      </label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex h-9 w-full items-center justify-between gap-2 rounded-xl border bg-panel px-3 text-left text-[13px] transition',
          open
            ? 'border-brand-600 ring-2 ring-brand-100'
            : 'border-line hover:border-brand-300',
        ].join(' ')}
      >
        <span className="truncate text-ink">{selected.label}</span>
        <ChevronDownIcon
          className={['size-3.5 shrink-0 text-muted transition', open ? 'rotate-180' : ''].join(
            ' ',
          )}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-md"
        >
          {STATUS_FILTERS.map((opt) => {
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

function ActivityDetailModal({
  row,
  onClose,
}: {
  row: ActivityRow
  onClose: () => void
}) {
  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEscape)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const fields = [
    { label: 'Dokumen', value: row.reference },
    { label: 'Jenis', value: row.type },
    { label: 'Tanggal', value: row.date },
    { label: 'Nilai', value: row.amount },
    { label: 'Status', value: STATUS_LABEL[row.status] },
    { label: 'Oleh', value: row.actor },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="motion-backdrop absolute inset-0 bg-ink/40"
        aria-label="Tutup detail"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-detail-title"
        className="motion-panel relative z-10 w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
              Detail dokumen
            </p>
            <h2
              id="activity-detail-title"
              className="mt-1 text-[16px] font-semibold text-ink"
            >
              {row.reference}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-brand-50 hover:text-ink"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <dl className="divide-y divide-line rounded-xl border border-line">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[13px]"
            >
              <dt className="text-muted">{field.label}</dt>
              <dd className="text-right font-medium text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-10 w-full rounded-xl bg-brand-800 text-[13px] font-semibold text-white transition hover:bg-brand-900"
        >
          Tutup
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  const PAGE_SIZE = usePageSize()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<ActivityRow | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false
      if (!q) return true
      return (
        row.type.toLowerCase().includes(q) ||
        row.reference.toLowerCase().includes(q) ||
        row.amount.toLowerCase().includes(q) ||
        row.actor.toLowerCase().includes(q) ||
        row.date.toLowerCase().includes(q)
      )
    })
  }, [rows, query, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const to = Math.min(safePage * PAGE_SIZE, filtered.length)
  const pageItems = getPageItems(safePage, totalPages)

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
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
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Cari dokumen, jenis…"
            className="h-9 w-full rounded-xl border border-line bg-panel py-2 pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-muted/70 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <StatusFilterSelect
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-surface/80 text-[11px] tracking-wide text-muted uppercase">
              <th className="px-3 py-2.5 font-medium">Dokumen</th>
              <th className="px-2 py-2.5 font-medium">Jenis</th>
              <th className="px-2 py-2.5 font-medium">Tanggal</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium">Nilai</th>
              <th className="px-2 py-2.5 font-medium">Oleh</th>
              <th className="w-16 px-3 py-2.5 text-center font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[13px] text-muted">
                  Belum ada dokumen di feed ini.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-line last:border-0 transition hover:bg-surface/80"
                >
                  <td className="num px-3 py-2.5 font-medium text-ink">{row.reference}</td>
                  <td className="px-2 py-2.5 text-ink">{row.type}</td>
                  <td className="num px-2 py-2.5 text-muted">{row.date}</td>
                  <td className="px-2 py-2.5">
                    <span
                      className={[
                        'inline-flex rounded-lg px-2.5 py-0.5 text-[11px] font-medium',
                        row.status === 'ok'
                          ? 'bg-brand-100 text-brand-800'
                          : row.status === 'warn'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="num px-2 py-2.5 font-medium text-ink">{row.amount}</td>
                  <td className="px-2 py-2.5 text-ink">{row.actor}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                      aria-label={`Lihat ${row.reference}`}
                      title="Lihat detail"
                    >
                      <EyeIcon className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">
          {filtered.length === 0
            ? 'Menampilkan 0 dari 0 dokumen'
            : `Menampilkan ${from}–${to} dari ${filtered.length} dokumen`}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sebelumnya
          </button>
          {pageItems.map((item, index) =>
            item === '…' ? (
              <span
                key={`e-${index}`}
                className="flex size-8 items-center justify-center font-mono text-[12px] text-muted"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                aria-current={item === safePage ? 'page' : undefined}
                className={[
                  'flex size-8 items-center justify-center rounded-xl font-mono text-[12px] transition',
                  item === safePage
                    ? 'bg-brand-800 font-semibold text-white'
                    : 'border border-line text-ink hover:bg-brand-50',
                ].join(' ')}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-xl border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </div>

      {detail ? (
        <ActivityDetailModal row={detail} onClose={() => setDetail(null)} />
      ) : null}
    </div>
  )
}
