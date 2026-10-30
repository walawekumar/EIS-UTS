import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import {
  FinanceEmptyRow,
  FinanceSortTh,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
  rowNumber,
  sortBy,
  toggleSort,
  type SortState,
} from '@/components/keuangan/FinanceTable'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { StageLabel } from '@/components/produksi/StatusLabel'
import { EyeIcon } from '@/components/ui/icons'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import {
  actualRendemen,
  berasQty,
  formatDate,
  formatQty,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'
import { usePageSize } from '@/features/settings/usePageSize'
import { StatusPill } from '@/components/keuangan/StatusPill'

type SortKey = 'id' | 'date' | 'target' | 'actual' | 'delta'
type Filter = 'semua' | 'done' | 'open'

type Props = {
  batches: ProductionBatch[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onGoToBatch: (id: string) => void
}

function buildStats(batches: ProductionBatch[]): MetricCardData[] {
  const done = batches.filter((b) => b.stage === 'done')
  const avgTarget =
    done.length === 0
      ? 0
      : done.reduce((s, b) => s + b.targetRendemen, 0) / done.length
  const avgActual =
    done.length === 0
      ? 0
      : done.reduce((s, b) => s + actualRendemen(b), 0) / done.length
  const below = done.filter((b) => actualRendemen(b) < b.targetRendemen)

  return [
    {
      label: 'Avg aktual',
      value: `${avgActual.toFixed(1)}%`,
      delta: `${done.length} batch selesai`,
      positive: avgActual >= avgTarget,
      spark: [62, 63, 64, 63, 65, 66, 65],
    },
    {
      label: 'Avg target',
      value: `${avgTarget.toFixed(1)}%`,
      delta: 'patokan',
      positive: true,
      spark: [65, 65, 65, 65, 65, 65, 65],
    },
    {
      label: 'Di bawah target',
      value: String(below.length),
      delta: below.length ? 'perlu cek' : 'OK',
      positive: below.length === 0,
      spark: [2, 1, 2, 1, 0, 1, 1],
    },
  ]
}

export function RendemenView({
  batches,
  selectedId,
  onSelect,
  onGoToBatch,
}: Props) {
  const PAGE_SIZE = usePageSize()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('semua')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<ProductionBatch | null>(null)

  const stats = useMemo(() => buildStats(batches), [batches])

  useEffect(() => setPage(1), [search, filter])

  useEffect(() => {
    if (!selectedId) return
    const row = batches.find((b) => b.id === selectedId)
    if (row) setDetail(row)
  }, [selectedId, batches])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = batches.filter((b) => {
      if (filter === 'done' && b.stage !== 'done') return false
      if (filter === 'open' && b.stage === 'done') return false
      if (filter === 'open' && b.stage === 'void') return false
      if (!q) return true
      return [b.id, b.inputName, b.operator].some((v) =>
        v.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (b) => b.id,
      date: (b) => b.date,
      target: (b) => b.targetRendemen,
      actual: (b) => actualRendemen(b),
      delta: (b) => actualRendemen(b) - b.targetRendemen,
    })
  }, [batches, search, filter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="text-[14px] font-semibold text-ink">Rendemen</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Target vs aktual (beras ÷ gabah input)
          </p>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari batch…"
          filter={filter}
          filterLabel="Cakupan"
          filterOptions={[
            { value: 'semua', label: 'Semua' },
            { value: 'done', label: 'Selesai saja' },
            { value: 'open', label: 'Belum selesai' },
          ]}
          onFilterChange={setFilter}
        />

        <FinanceTable>
          <FinanceThead>
            <FinanceTh className="w-10">#</FinanceTh>
            <FinanceSortTh label="Batch" sortKey="id" sort={sort} onSort={handleSort} />
            <FinanceSortTh label="Tanggal" sortKey="date" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Target"
              sortKey="target"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Aktual"
              sortKey="actual"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Δ"
              sortKey="delta"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh>Status</FinanceTh>
            <FinanceTh align="center">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Tidak ada data." />
            ) : (
              rows.map((row, index) => {
                const actual = actualRendemen(row)
                const delta = actual - row.targetRendemen
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd>
                      <p className="font-medium text-ink">{row.id}</p>
                      <p className="text-[11px] text-muted">{row.inputName}</p>
                    </FinanceTd>
                    <FinanceTd>{formatDate(row.date)}</FinanceTd>
                    <FinanceTd mono>{row.targetRendemen.toFixed(1)}%</FinanceTd>
                    <FinanceTd mono>{actual.toFixed(1)}%</FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={`${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp`}
                        tone={delta >= 0 ? 'good' : 'warn'}
                      />
                    </FinanceTd>
                    <FinanceTd>
                      <StageLabel stage={row.stage} />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <button
                        type="button"
                        onClick={() => {
                          setDetail(row)
                          onSelect(row.id)
                        }}
                        className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                        aria-label={`Detail ${row.id}`}
                      >
                        <EyeIcon className="size-[18px]" />
                      </button>
                    </FinanceTd>
                  </FinanceTr>
                )
              })
            )}
          </tbody>
        </FinanceTable>

        <FinancePager
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </section>

      {detail ? (
        <DetailDrawer
          open
          onClose={() => {
            setDetail(null)
            onSelect(null)
          }}
          title={detail.id}
          subtitle="Analisis rendemen"
          badge={<StageLabel stage={detail.stage} />}
          footer={
            <button
              type="button"
              onClick={() => onGoToBatch(detail.id)}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Ke kartu batch
            </button>
          }
        >
          <DrawerHero
            label="Rendemen aktual"
            amount={`${actualRendemen(detail).toFixed(1)}%`}
            hint={`Target ${detail.targetRendemen}%`}
          />
          <DrawerSection label="Perhitungan">
            <DrawerFacts
              items={[
                [
                  'Input gabah',
                  formatQty(detail.inputQty, detail.inputUnit),
                ],
                ['Qty beras', formatQty(berasQty(detail), 'kg')],
                [
                  'Rumus',
                  '(beras ÷ gabah) × 100',
                ],
                [
                  'Δ vs target',
                  `${(actualRendemen(detail) - detail.targetRendemen).toFixed(1)} poin`,
                ],
              ]}
            />
          </DrawerSection>
        </DetailDrawer>
      ) : null}
    </div>
  )
}
