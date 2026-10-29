import { useMemo, useState } from 'react'
import type { ActivityRow } from '@/features/dashboard/dashboard-data'

const STATUS_LABEL = {
  ok: 'Selesai',
  warn: 'Tinjau',
  draft: 'Draft',
} as const

const STATUS_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'ok', label: 'Selesai' },
  { id: 'warn', label: 'Tinjau' },
  { id: 'draft', label: 'Draft' },
] as const

const PAGE_SIZE = 4

type StatusFilter = (typeof STATUS_FILTERS)[number]['id']

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

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

  function updateQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function updateStatus(value: StatusFilter) {
    setStatus(value)
    setPage(1)
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Cari referensi, jenis…"
            className="h-9 w-full rounded-xl border border-line bg-white py-2 pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-muted/70 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[11px] font-medium text-muted">Filter</span>
          {STATUS_FILTERS.map((opt) => {
            const active = status === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateStatus(opt.id)}
                className={[
                  'rounded-xl px-2.5 py-1 text-[12px] font-medium transition',
                  active
                    ? 'bg-brand-800 text-white'
                    : 'border border-line text-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-ink/20 text-[11px] tracking-wide text-muted uppercase">
              <th className="py-2 pr-3 font-medium">Tanggal</th>
              <th className="py-2 pr-3 font-medium">Jenis</th>
              <th className="py-2 pr-3 font-medium">Referensi</th>
              <th className="py-2 pr-3 font-medium">Nilai</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Oleh</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[13px] text-muted">
                  Tidak ada aktivitas yang cocok.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={`${row.reference}-${row.date}`}
                  className="border-b border-line last:border-0"
                >
                  <td className="num py-2.5 pr-3 text-muted">{row.date}</td>
                  <td className="py-2.5 pr-3 text-ink">{row.type}</td>
                  <td className="num py-2.5 pr-3 text-ink">{row.reference}</td>
                  <td className="num py-2.5 pr-3 text-ink">{row.amount}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={[
                        'inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] font-medium',
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
                  <td className="py-2.5 text-muted">{row.actor}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="font-mono text-[11px] text-muted">
          {filtered.length === 0
            ? '0 dari 0'
            : `${from}–${to} dari ${filtered.length}`}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-line px-2.5 py-1 text-[12px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span className="min-w-16 text-center font-mono text-[11px] text-muted">
            {safePage}/{totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-xl border border-line px-2.5 py-1 text-[12px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  )
}
