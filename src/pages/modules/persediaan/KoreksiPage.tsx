import { useEffect, useMemo, useState } from 'react'
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
  buildKoreksiStats,
  formatQty,
  type CorrectionRow,
} from '@/features/persediaan/persediaan-data'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { inDateRange } from '@/features/persediaan/persediaan-utils'

const PAGE_SIZE = 6

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua status' },
  { value: 'posted', label: 'Posted' },
  { value: 'void', label: 'Void' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']
type SortKey =
  | 'reference'
  | 'date'
  | 'productName'
  | 'location'
  | 'beforeQty'
  | 'afterQty'
  | 'status'

export function KoreksiPage() {
  const { stocks, corrections, addCorrection, voidCorrection } =
    usePersediaanStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<CorrectionRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [stockId, setStockId] = useState(stocks[0]?.id ?? '')
  const [afterQty, setAfterQty] = useState('')
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState<ReceiptValue>(null)
  const [errors, setErrors] = useState<{ afterQty?: string; reason?: string }>(
    {},
  )
  const [toast, setToast] = useState<string | null>(null)

  const stats = useMemo(() => buildKoreksiStats(corrections), [corrections])
  const selected = stocks.find((s) => s.id === stockId) ?? stocks[0]

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
    const base = corrections.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!inDateRange(row.date, dateFrom, dateTo)) return false
      if (!q) return true
      return (
        row.reference.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q) ||
        row.location.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      reference: (r) => r.reference,
      date: (r) => r.date,
      productName: (r) => r.productName,
      location: (r) => r.location,
      beforeQty: (r) => r.beforeQty,
      afterQty: (r) => r.afterQty,
      status: (r) => r.status,
    })
  }, [corrections, search, statusFilter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function openForm() {
    const first = stocks[0]
    setStockId(first?.id ?? '')
    setAfterQty(first ? String(first.qty) : '')
    setReason('')
    setReceipt(null)
    setErrors({})
    setFormOpen(true)
  }

  function submit() {
    if (!selected) return
    const qty = Number(afterQty.replace(/[^\d]/g, ''))
    const next: { afterQty?: string; reason?: string } = {}
    if (Number.isNaN(qty) || qty < 0) next.afterQty = 'Jumlah tidak valid'
    if (!reason.trim()) next.reason = 'Alasan wajib diisi'
    if (qty === selected.qty) next.afterQty = 'Saldo baru harus berbeda'
    setErrors(next)
    if (Object.keys(next).length) return

    addCorrection({
      sku: selected.sku,
      productName: selected.name,
      location: selected.location,
      unit: selected.unit,
      beforeQty: selected.qty,
      afterQty: qty,
      reason: reason.trim(),
      receiptName: receipt?.name,
    })
    setFormOpen(false)
    setReceipt(null)
    setPage(1)
    setToast('Koreksi dicatat · saldo diperbarui')
  }

  function handlePrint(row: CorrectionRow) {
    const ok = printBukti(`Bukti koreksi ${row.reference}`, [
      { label: 'Tanggal', value: row.date },
      { label: 'SKU', value: row.sku },
      { label: 'Produk', value: row.productName },
      { label: 'Lokasi', value: row.location },
      { label: 'Sebelum', value: formatQty(row.beforeQty, row.unit) },
      { label: 'Sesudah', value: formatQty(row.afterQty, row.unit) },
      {
        label: 'Selisih',
        value: formatQty(row.afterQty - row.beforeQty, row.unit),
      },
      { label: 'Alasan', value: row.reason },
      { label: 'Status', value: row.status === 'posted' ? 'Posted' : 'Void' },
      { label: 'Oleh', value: row.actor },
      { label: 'Bukti', value: row.receiptName ?? '—' },
    ])
    if (!ok) setToast('Izinkan popup untuk mencetak')
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Koreksi stok</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Penyesuaian saldo dengan alasan — void mengembalikan qty lama
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
          searchPlaceholder="Cari referensi, produk, alasan…"
          filter={statusFilter}
          filterOptions={STATUS_FILTERS}
          onFilterChange={(v) => {
            setStatusFilter(v)
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
          actionLabel="+ Catat koreksi"
          onAction={openForm}
        />

        <FinanceTable minWidth="900px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Referensi" sortKey="reference" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Tanggal" sortKey="date" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Produk" sortKey="productName" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Lokasi" sortKey="location" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Sebelum" sortKey="beforeQty" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Sesudah" sortKey="afterQty" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceSortTh label="Status" sortKey="status" sort={sort} onSort={(k) => { setSort((p) => toggleSort(p, k)); setPage(1) }} />
            <FinanceTh>Oleh</FinanceTh>
            <FinanceTh align="right" className="w-28">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={10} message="Tidak ada koreksi yang cocok." />
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
                    <p className="font-medium">{row.productName}</p>
                    <p className="font-mono text-[11px] text-muted">{row.sku}</p>
                  </FinanceTd>
                  <FinanceTd>{row.location}</FinanceTd>
                  <FinanceTd mono>{formatQty(row.beforeQty, row.unit)}</FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {formatQty(row.afterQty, row.unit)}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={row.status === 'posted' ? 'Posted' : 'Void'}
                      tone={row.status === 'posted' ? 'good' : 'muted'}
                    />
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
          subtitle="Detail koreksi"
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
              {detail.status === 'posted' ? (
                <button
                  type="button"
                  onClick={() => {
                    voidCorrection(detail.id)
                    setDetail(null)
                    setToast(`${detail.reference} di-void · saldo dikembalikan`)
                  }}
                  className="h-11 min-w-[7.5rem] flex-1 rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
                >
                  Void
                </button>
              ) : null}
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
              { label: 'Produk', value: `${detail.productName} (${detail.sku})` },
              { label: 'Lokasi', value: detail.location },
              {
                label: 'Sebelum',
                value: formatQty(detail.beforeQty, detail.unit),
              },
              {
                label: 'Sesudah',
                value: formatQty(detail.afterQty, detail.unit),
              },
              {
                label: 'Selisih',
                value: formatQty(
                  detail.afterQty - detail.beforeQty,
                  detail.unit,
                ),
              },
              { label: 'Alasan', value: detail.reason },
              {
                label: 'Status',
                value: detail.status === 'posted' ? 'Posted' : 'Void',
              },
              { label: 'Oleh', value: detail.actor },
              { label: 'Bukti', value: detail.receiptName ?? 'Tidak ada' },
            ]}
          />
        </FinanceModal>
      ) : null}

      {formOpen && selected ? (
        <FinanceModal
          title="Catat koreksi stok"
          subtitle="Sesuaikan saldo dengan alasan"
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
              confirmLabel="Simpan koreksi"
            />
          }
        >
          <div className="space-y-3">
            <Select
              label="Stok / lokasi"
              value={selected.id}
              options={stockOptions}
              onChange={(id) => {
                setStockId(id)
                const row = stocks.find((s) => s.id === id)
                if (row) setAfterQty(String(row.qty))
              }}
              requiredMark
            />
            <DetailFields
              fields={[
                {
                  label: 'Saldo saat ini',
                  value: formatQty(selected.qty, selected.unit),
                },
              ]}
            />
            <TextField
              id="koreksi-after"
              label={`Saldo baru (${selected.unit})`}
              requiredMark
              inputMode="numeric"
              value={afterQty}
              error={errors.afterQty}
              onChange={(e) => setAfterQty(e.target.value)}
            />
            <TextAreaField
              id="koreksi-reason"
              label="Alasan koreksi"
              requiredMark
              value={reason}
              error={errors.reason}
              onChange={setReason}
              rows={2}
            />
            <ReceiptUpload
              value={receipt}
              onChange={setReceipt}
              label="Upload bukti koreksi"
            />
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}
