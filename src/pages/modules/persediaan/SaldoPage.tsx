import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
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
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { printBukti } from '@/components/keuangan/print-bukti'
import { EyeIcon } from '@/components/ui/icons'
import {
  CATEGORY_LABEL,
  LOCATIONS,
  buildSaldoStats,
  formatQty,
  isLowStock,
  type StockCategory,
  type StockRow,
} from '@/features/persediaan/persediaan-data'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import {
  buildStockLedger,
  exportSaldoCsv,
  formatDelta,
} from '@/features/persediaan/persediaan-utils'
import { usePageSize } from '@/features/settings/usePageSize'

const CATEGORY_FILTERS = [
  { value: 'all', label: 'Semua kategori' },
  { value: 'gabah', label: 'Gabah' },
  { value: 'beras', label: 'Beras' },
  { value: 'sampingan', label: 'Sampingan' },
] as const

const LOCATION_FILTERS = [
  { value: 'all', label: 'Semua lokasi' },
  ...LOCATIONS.map((l) => ({ value: l, label: l })),
] as const

type CatFilter = (typeof CATEGORY_FILTERS)[number]['value']
type LocFilter = (typeof LOCATION_FILTERS)[number]['value']
type SortKey =
  | 'sku'
  | 'name'
  | 'category'
  | 'location'
  | 'qty'
  | 'minQty'
  | 'updatedAt'

export function SaldoPage() {
  const PAGE_SIZE = usePageSize()
  const navigate = useNavigate()
  const { stocks, movements, corrections } = usePersediaanStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CatFilter>('all')
  const [location, setLocation] = useState<LocFilter>('all')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'name',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<StockRow | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const stats = useMemo(() => buildSaldoStats(stocks), [stocks])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = stocks.filter((row) => {
      if (category !== 'all' && row.category !== category) return false
      if (location !== 'all' && row.location !== location) return false
      if (!q) return true
      return (
        row.sku.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.location.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      sku: (r) => r.sku,
      name: (r) => r.name,
      category: (r) => r.category,
      location: (r) => r.location,
      qty: (r) => r.qty,
      minQty: (r) => r.minQty,
      updatedAt: (r) => r.updatedAt,
    })
  }, [stocks, search, category, location, sort])

  const ledger = useMemo(
    () => (detail ? buildStockLedger(detail, movements, corrections) : []),
    [detail, movements, corrections],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function handlePrint(row: StockRow) {
    const ok = printBukti(`Kartu stok ${row.sku}`, [
      { label: 'SKU', value: row.sku },
      { label: 'Nama', value: row.name },
      { label: 'Kategori', value: CATEGORY_LABEL[row.category] },
      { label: 'Lokasi', value: row.location },
      { label: 'Saldo', value: formatQty(row.qty, row.unit) },
      { label: 'Min. stok', value: formatQty(row.minQty, row.unit) },
      {
        label: 'Status',
        value: isLowStock(row) ? 'Stok rendah' : 'Aman',
      },
      { label: 'Diperbarui', value: row.updatedAt },
    ])
    if (!ok) setToast('Izinkan popup untuk mencetak')
  }

  function goMutasiMasuk(row: StockRow) {
    navigate(
      `/app/persediaan/mutasi?stockId=${encodeURIComponent(row.id)}&type=in`,
    )
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Saldo stok</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Per lokasi gudang — stok rendah ditandai otomatis
            </p>
          </div>
          <FinanceToast message={toast} />
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari SKU, nama, lokasi…"
          filter={category}
          filterOptions={CATEGORY_FILTERS}
          onFilterChange={(v) => {
            setCategory(v)
            setPage(1)
          }}
          filterLabel="Kategori"
          secondaryFilter={location}
          secondaryFilterOptions={LOCATION_FILTERS}
          onSecondaryFilterChange={(v) => {
            setLocation(v)
            setPage(1)
          }}
          secondaryFilterLabel="Lokasi"
          secondaryActionLabel="Export CSV"
          onSecondaryAction={() => {
            exportSaldoCsv(filtered)
            setToast(`CSV diekspor · ${filtered.length} baris`)
          }}
        />

        <FinanceTable minWidth="820px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="SKU" sortKey="sku" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Nama" sortKey="name" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Kategori" sortKey="category" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Lokasi" sortKey="location" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Saldo" sortKey="qty" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Min" sortKey="minQty" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceTh>Status</FinanceTh>
            <FinanceTh align="center" className="w-36">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={9} message="Tidak ada stok yang cocok." />
            ) : (
              rows.map((row, index) => {
                const low = isLowStock(row)
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">{row.sku}</FinanceTd>
                    <FinanceTd className="font-medium">{row.name}</FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={CATEGORY_LABEL[row.category as StockCategory]}
                        tone="neutral"
                      />
                    </FinanceTd>
                    <FinanceTd>{row.location}</FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {formatQty(row.qty, row.unit)}
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {formatQty(row.minQty, row.unit)}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={low ? 'Rendah' : 'Aman'}
                        tone={low ? 'warn' : 'good'}
                      />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        {low ? (
                          <button
                            type="button"
                            onClick={() => goMutasiMasuk(row)}
                            className="rounded-xl px-2 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-50"
                            title="Catat mutasi masuk"
                          >
                            + Masuk
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setDetail(row)}
                          className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                          aria-label={`Detail ${row.sku}`}
                        >
                          <EyeIcon className="size-[18px]" />
                        </button>
                      </div>
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
        <SaldoDetailDrawer
          row={detail}
          ledger={ledger}
          onClose={() => setDetail(null)}
          onPrint={() => handlePrint(detail)}
          onGoMutasiMasuk={() => goMutasiMasuk(detail)}
        />
      ) : null}
    </div>
  )
}

function SaldoDetailDrawer({
  row,
  ledger,
  onClose,
  onPrint,
  onGoMutasiMasuk,
}: {
  row: StockRow
  ledger: ReturnType<typeof buildStockLedger>
  onClose: () => void
  onPrint: () => void
  onGoMutasiMasuk: () => void
}) {
  const low = isLowStock(row)

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={row.name}
      subtitle={`Kartu stok · ${row.sku}`}
      badge={
        <StatusPill label={low ? 'Rendah' : 'Aman'} tone={low ? 'warn' : 'good'} />
      }
      footer={
        <>
          <button
            type="button"
            onClick={onPrint}
            className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
          >
            Cetak bukti
          </button>
          {low ? (
            <button
              type="button"
              onClick={onGoMutasiMasuk}
              className="h-11 w-full rounded-xl border border-amber-300 bg-amber-50 text-[14px] font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Catat masuk
            </button>
          ) : null}
        </>
      }
    >
      <DrawerHero
        label="Saldo saat ini"
        amount={formatQty(row.qty, row.unit)}
        tone={low ? 'warn' : 'good'}
        hint={`Min. stok ${formatQty(row.minQty, row.unit)} · diperbarui ${row.updatedAt}`}
      />

      <DrawerSection label="Rincian">
        <DrawerFacts
          items={[
            ['SKU', row.sku],
            ['Kategori', CATEGORY_LABEL[row.category]],
            ['Lokasi', row.location],
            ['Saldo', formatQty(row.qty, row.unit)],
            ['Min. stok', formatQty(row.minQty, row.unit)],
            ['Status', low ? 'Stok rendah' : 'Aman'],
            ['Diperbarui', row.updatedAt],
          ]}
        />
      </DrawerSection>

      <DrawerSection label="Riwayat kartu stok">
        {ledger.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-muted">
            Belum ada riwayat mutasi atau koreksi untuk SKU + lokasi ini.
          </p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {ledger.map((entry) => (
              <li
                key={`${entry.kind}-${entry.id}`}
                className="rounded-xl border border-line bg-surface/60 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {entry.reference} · {entry.label}
                      {entry.status === 'void' ? ' (void)' : ''}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {entry.date} · {entry.note}
                    </p>
                  </div>
                  <span
                    className={[
                      'shrink-0 font-mono text-[12px] font-semibold',
                      entry.delta >= 0 ? 'text-brand-800' : 'text-amber-800',
                    ].join(' ')}
                  >
                    {formatDelta(entry.delta, entry.unit)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>
    </DetailDrawer>
  )
}
