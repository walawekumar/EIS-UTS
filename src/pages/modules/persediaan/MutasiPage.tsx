import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  DetailFields,
  FinanceModal,
  ModalActions,
  TextAreaField,
} from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import {
  ActorCell,
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
import {
  ReceiptUpload,
  type ReceiptValue,
} from '@/components/keuangan/ReceiptUpload'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { printBukti } from '@/components/keuangan/print-bukti'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import {
  LOCATIONS,
  MOVEMENT_LABEL,
  buildMutasiStats,
  formatQty,
  type MovementRow,
  type MovementType,
} from '@/features/persediaan/persediaan-data'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import {
  exportMutasiCsv,
  inDateRange,
} from '@/features/persediaan/persediaan-utils'

const PAGE_SIZE = 6

const TYPE_FILTERS = [
  { value: 'all', label: 'Semua jenis' },
  { value: 'in', label: 'Masuk' },
  { value: 'out', label: 'Keluar' },
  { value: 'transfer', label: 'Transfer' },
] as const

type TypeFilter = (typeof TYPE_FILTERS)[number]['value']
type SortKey = 'reference' | 'date' | 'type' | 'productName' | 'qty' | 'actor'

type FormState = {
  type: MovementType
  stockId: string
  qty: string
  toLocation: string
  note: string
}

export function MutasiPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { stocks, movements, addMovement } = usePersediaanStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<MovementRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>({
    type: 'in',
    stockId: stocks[0]?.id ?? '',
    qty: '',
    toLocation: LOCATIONS[1],
    note: '',
  })
  const [receipt, setReceipt] = useState<ReceiptValue>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  )
  const [toast, setToast] = useState<string | null>(null)

  const stats = useMemo(() => buildMutasiStats(movements), [movements])
  const selectedStock = stocks.find((s) => s.id === form.stockId) ?? stocks[0]

  const stockOptions = useMemo(
    () =>
      stocks.map((s) => ({
        value: s.id,
        label: `${s.name} · ${s.location}`,
        description: `${s.sku} · saldo ${formatQty(s.qty, s.unit)}`,
      })),
    [stocks],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = movements.filter((row) => {
      if (typeFilter !== 'all' && row.type !== typeFilter) return false
      if (!inDateRange(row.date, dateFrom, dateTo)) return false
      if (!q) return true
      return (
        row.reference.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.note.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      reference: (r) => r.reference,
      date: (r) => r.date,
      type: (r) => r.type,
      productName: (r) => r.productName,
      qty: (r) => r.qty,
      actor: (r) => r.actor,
    })
  }, [movements, search, typeFilter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const stockId = searchParams.get('stockId')
    const typeParam = searchParams.get('type')
    if (!stockId && !typeParam) return

    const type: MovementType =
      typeParam === 'out' || typeParam === 'transfer' || typeParam === 'in'
        ? typeParam
        : 'in'
    const stock = stocks.find((s) => s.id === stockId) ?? stocks[0]
    if (!stock) return

    setForm({
      type,
      stockId: stock.id,
      qty: '',
      toLocation:
        LOCATIONS.find((l) => l !== stock.location) ?? LOCATIONS[0],
      note: type === 'in' ? 'Restock stok rendah' : '',
    })
    setReceipt(null)
    setErrors({})
    setFormOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, stocks])

  function openForm(type: MovementType = 'in', stockId?: string) {
    const stock = stocks.find((s) => s.id === stockId) ?? stocks[0]
    setForm({
      type,
      stockId: stock?.id ?? '',
      qty: '',
      toLocation:
        LOCATIONS.find((l) => l !== stock?.location) ?? LOCATIONS[0],
      note: '',
    })
    setReceipt(null)
    setErrors({})
    setFormOpen(true)
  }

  function submit() {
    if (!selectedStock) return
    const next: Partial<Record<keyof FormState, string>> = {}
    const qty = Number(form.qty.replace(/[^\d]/g, ''))
    if (!qty || qty <= 0) next.qty = 'Jumlah harus lebih dari 0'
    if (form.type !== 'in' && qty > selectedStock.qty) {
      next.qty = `Maksimal ${formatQty(selectedStock.qty, selectedStock.unit)}`
    }
    if (form.type === 'transfer' && form.toLocation === selectedStock.location) {
      next.toLocation = 'Lokasi tujuan harus berbeda'
    }
    if (!form.note.trim()) next.note = 'Keterangan wajib diisi'
    setErrors(next)
    if (Object.keys(next).length) return

    addMovement({
      type: form.type,
      sku: selectedStock.sku,
      productName: selectedStock.name,
      unit: selectedStock.unit,
      qty,
      fromLocation:
        form.type === 'in' ? '—' : selectedStock.location,
      toLocation:
        form.type === 'out'
          ? '—'
          : form.type === 'in'
            ? selectedStock.location
            : form.toLocation,
      note: form.note.trim(),
      receiptName: receipt?.name,
    })
    setFormOpen(false)
    setReceipt(null)
    setPage(1)
    setToast(
      `Mutasi ${MOVEMENT_LABEL[form.type].toLowerCase()} dicatat · saldo diperbarui`,
    )
  }

  function handlePrint(row: MovementRow) {
    const lokasiFields =
      row.type === 'in'
        ? [{ label: 'Tujuan', value: row.toLocation }]
        : row.type === 'out'
          ? [{ label: 'Asal', value: row.fromLocation }]
          : [
              { label: 'Dari', value: row.fromLocation },
              { label: 'Ke', value: row.toLocation },
            ]
    const ok = printBukti(`Bukti mutasi ${row.reference}`, [
      { label: 'Tanggal', value: row.date },
      { label: 'Jenis', value: MOVEMENT_LABEL[row.type] },
      { label: 'SKU', value: row.sku },
      { label: 'Produk', value: row.productName },
      ...lokasiFields,
      { label: 'Jumlah', value: formatQty(row.qty, row.unit) },
      { label: 'Keterangan', value: row.note },
      { label: 'Oleh', value: row.actor },
      { label: 'Bukti', value: row.receiptName ?? '—' },
    ])
    if (!ok) setToast('Izinkan popup untuk mencetak')
  }

  const tone = (type: MovementType) =>
    type === 'in' ? 'good' : type === 'out' ? 'warn' : 'neutral'

  function LocationCell({ row }: { row: MovementRow }) {
    if (row.type === 'in') {
      return (
        <div>
          <p className="text-[11px] text-muted">Tujuan</p>
          <p className="text-[13px] font-medium text-ink">{row.toLocation}</p>
        </div>
      )
    }
    if (row.type === 'out') {
      return (
        <div>
          <p className="text-[11px] text-muted">Asal</p>
          <p className="text-[13px] font-medium text-ink">{row.fromLocation}</p>
        </div>
      )
    }
    return (
      <div className="space-y-0.5">
        <p className="text-[13px] text-ink">
          <span className="text-muted">Dari</span> {row.fromLocation}
        </p>
        <p className="text-[13px] text-ink">
          <span className="text-muted">Ke</span> {row.toLocation}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Mutasi stok</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Masuk, keluar, dan transfer antar gudang
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
          searchPlaceholder="Cari referensi, produk, catatan…"
          filter={typeFilter}
          filterOptions={TYPE_FILTERS}
          onFilterChange={(v) => {
            setTypeFilter(v)
            setPage(1)
          }}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(v) => {
            setDateFrom(v)
            setPage(1)
          }}
          onDateToChange={(v) => {
            setDateTo(v)
            setPage(1)
          }}
          secondaryActionLabel="Export CSV"
          onSecondaryAction={() => {
            exportMutasiCsv(filtered)
            setToast(`CSV diekspor · ${filtered.length} baris`)
          }}
          actionLabel="+ Catat mutasi"
          onAction={() => openForm('in')}
        />

        <FinanceTable minWidth="900px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Referensi" sortKey="reference" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Tanggal" sortKey="date" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Jenis" sortKey="type" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Produk" sortKey="productName" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceTh>Lokasi</FinanceTh>
            <FinanceSortTh label="Jumlah" sortKey="qty" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Oleh" sortKey="actor" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceTh align="right" className="w-28">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={9} message="Tidak ada mutasi yang cocok." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {row.reference}
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {row.date}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={MOVEMENT_LABEL[row.type]}
                      tone={tone(row.type)}
                    />
                  </FinanceTd>
                  <FinanceTd>
                    <p className="font-medium text-ink">{row.productName}</p>
                    <p className="font-mono text-[11px] text-muted">{row.sku}</p>
                  </FinanceTd>
                  <FinanceTd>
                    <LocationCell row={row} />
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {formatQty(row.qty, row.unit)}
                  </FinanceTd>
                  <FinanceTd>
                    <ActorCell name={row.actor} />
                  </FinanceTd>
                  <FinanceTd align="right">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                    >
                      <EyeIcon className="size-[18px]" />
                    </button>
                  </FinanceTd>
                </FinanceTr>
              ))
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
        <FinanceModal
          title={detail.reference}
          subtitle="Detail mutasi"
          onClose={() => setDetail(null)}
          footer={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePrint(detail)}
                className="h-11 min-w-[7.5rem] flex-1 rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Cetak
              </button>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="h-11 min-w-[7.5rem] flex-1 rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Tutup
              </button>
            </div>
          }
        >
          <DetailFields
            fields={[
              { label: 'Tanggal', value: detail.date },
              { label: 'Jenis', value: MOVEMENT_LABEL[detail.type] },
              { label: 'Produk', value: `${detail.productName} (${detail.sku})` },
              ...(detail.type === 'in'
                ? [{ label: 'Tujuan', value: detail.toLocation }]
                : detail.type === 'out'
                  ? [{ label: 'Asal', value: detail.fromLocation }]
                  : [
                      { label: 'Dari', value: detail.fromLocation },
                      { label: 'Ke', value: detail.toLocation },
                    ]),
              { label: 'Jumlah', value: formatQty(detail.qty, detail.unit) },
              { label: 'Keterangan', value: detail.note },
              { label: 'Oleh', value: detail.actor },
              { label: 'Bukti', value: detail.receiptName ?? 'Tidak ada' },
            ]}
          />
        </FinanceModal>
      ) : null}

      {formOpen && selectedStock ? (
        <FinanceModal
          title="Catat mutasi stok"
          subtitle="Masuk / keluar / transfer"
          onClose={() => {
            setFormOpen(false)
            setReceipt(null)
          }}
          wide
          footer={
            <ModalActions
              onCancel={() => {
                setFormOpen(false)
                setReceipt(null)
              }}
              onConfirm={submit}
              confirmLabel="Simpan mutasi"
            />
          }
        >
          <div className="space-y-3">
            <Select
              label="Jenis mutasi"
              value={form.type}
              options={[
                { value: 'in', label: 'Masuk', description: 'Tambah stok di lokasi' },
                { value: 'out', label: 'Keluar', description: 'Kurangi stok dari lokasi' },
                {
                  value: 'transfer',
                  label: 'Transfer',
                  description: 'Pindah antar gudang',
                },
              ]}
              onChange={(type) => setForm((f) => ({ ...f, type }))}
              requiredMark
            />
            <Select
              label={form.type === 'in' ? 'Stok / lokasi tujuan' : 'Stok sumber'}
              value={selectedStock.id}
              options={stockOptions}
              onChange={(stockId) => setForm((f) => ({ ...f, stockId }))}
              requiredMark
            />
            {form.type === 'transfer' ? (
              <Select
                label="Lokasi tujuan"
                value={form.toLocation}
                options={LOCATIONS.map((l) => ({ value: l, label: l }))}
                onChange={(toLocation) => setForm((f) => ({ ...f, toLocation }))}
                requiredMark
              />
            ) : null}
            {errors.toLocation ? (
              <p className="text-xs text-red-600">{errors.toLocation}</p>
            ) : null}
            <TextField
              id="mut-qty"
              label={`Jumlah (${selectedStock.unit})`}
              requiredMark
              inputMode="numeric"
              value={form.qty}
              error={errors.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
            <TextAreaField
              id="mut-note"
              label="Keterangan"
              requiredMark
              value={form.note}
              error={errors.note}
              onChange={(note) => setForm((f) => ({ ...f, note }))}
              rows={2}
            />
            <ReceiptUpload
              value={receipt}
              onChange={setReceipt}
              label="Upload bukti mutasi"
            />
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}
