import { useState } from 'react'
import {
  EmptyState,
  FilterDropdown,
  SearchInput,
  panelClass,
  primaryBtn,
} from '@/components/pembelian/Toolbar'
import { BatchStatusLabel, displayStatus } from '@/components/produksi/BatchStatusLabel'
import { formatDate, formatKg, formatPercent } from '@/features/pembelian/pembelian-data'
import { calcBatch, getLot, type Batch, type BatchStatus } from '@/features/produksi/produksi-data'

type StatusFilter = 'semua' | BatchStatus | 'tinjau'

type BatchListViewProps = {
  batches: Batch[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

export function BatchListView({ batches, selectedId, onSelect, onCreate }: BatchListViewProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('semua')

  const matches = (b: Batch, f: StatusFilter) => f === 'semua' || displayStatus(b) === f

  const q = query.trim().toLowerCase()
  const rows = batches
    .filter((b) => matches(b, filter))
    .filter((b) => {
      if (!q) return true
      const lot = getLot(b.lotId)
      return [b.id, b.lotId, lot?.supplier, b.operator, b.line].some((v) => v?.toLowerCase().includes(q))
    })

  const count = (f: StatusFilter) => batches.filter((b) => matches(b, f)).length

  return (
    <section className={[panelClass, 'min-w-0'].join(' ')}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Batch giling</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {rows.length === batches.length ? `${batches.length} batch` : `${rows.length} dari ${batches.length} batch`}
          </p>
        </div>
        <button type="button" onClick={onCreate} className={primaryBtn}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Batch baru
        </button>
      </div>

      <div className="flex items-center gap-2 px-5 pb-3">
        <SearchInput fullWidth value={query} onChange={setQuery} placeholder="Cari batch, lot, atau operator…" />
        <FilterDropdown
          label="Status"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'semua', label: 'Semua', tone: 'bg-slate-300', count: count('semua') },
            { id: 'proses', label: 'Sedang giling', tone: 'bg-amber-500', count: count('proses') },
            { id: 'rencana', label: 'Direncanakan', tone: 'bg-slate-400', count: count('rencana') },
            { id: 'selesai', label: 'Selesai', tone: 'bg-brand-600', count: count('selesai') },
            { id: 'tinjau', label: 'Perlu ditinjau', tone: 'bg-red-500', count: count('tinjau') },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Tidak ada batch yang cocok" hint="Ubah filter atau kata kunci pencarian." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px] tabular-nums">
            <thead>
              <tr className="border-y border-line bg-surface/60 text-[12px] whitespace-nowrap text-muted">
                <th className="py-2.5 pr-4 pl-5 font-medium">Batch</th>
                <th className="py-2.5 pr-4 font-medium">Tanggal</th>
                <th className="py-2.5 pr-4 font-medium">Lot gabah</th>
                <th className="py-2.5 pr-4 text-right font-medium">Input</th>
                <th className="py-2.5 pr-4 text-right font-medium">Rendemen</th>
                <th className="py-2.5 pr-4 text-right font-medium">Selisih</th>
                <th className="py-2.5 pr-5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const calc = b.outputs ? calcBatch(b.inputKg, b.outputs) : null
                const active = b.id === selectedId
                return (
                  <tr
                    key={b.id}
                    tabIndex={0}
                    aria-selected={active}
                    onClick={() => onSelect(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(b.id)
                      }
                    }}
                    className={[
                      'cursor-pointer border-b border-line whitespace-nowrap outline-none transition last:border-0 focus-visible:bg-brand-50',
                      active ? 'bg-brand-50/70' : 'hover:bg-surface/60',
                    ].join(' ')}
                  >
                    <td className="relative py-3.5 pr-4 pl-5 font-medium text-ink">
                      {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-brand-600" /> : null}
                      {b.id}
                    </td>
                    <td className="py-3.5 pr-4 text-muted">{formatDate(b.date)}</td>
                    <td className="py-3.5 pr-4 text-ink" title={getLot(b.lotId)?.supplier}>
                      {b.lotId}
                    </td>
                    <td className="py-3.5 pr-4 text-right text-ink">{formatKg(b.inputKg)}</td>
                    <td
                      className={[
                        'py-3.5 pr-4 text-right',
                        !calc ? 'text-muted/60' : calc.lowYield ? 'font-medium text-amber-700' : 'text-ink',
                      ].join(' ')}
                    >
                      {calc ? formatPercent(calc.rendemen) : '—'}
                    </td>
                    <td
                      className={[
                        'py-3.5 pr-4 text-right',
                        !calc ? 'text-muted/60' : calc.lossHigh ? 'font-medium text-red-700' : 'text-ink',
                      ].join(' ')}
                    >
                      {calc ? formatPercent(calc.lossPct) : '—'}
                    </td>
                    <td className="py-3.5 pr-5">
                      <BatchStatusLabel batch={b} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
