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
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceSortTh,
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
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { TextField } from '@/components/ui/TextField'
import { printBukti } from '@/components/keuangan/print-bukti'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import {
  PAYABLE_STATUS_LABEL,
  buildUtangStats,
  formatIdr,
  parseIdrInput,
  type PayableRow,
  type PayableStatus,
} from '@/features/keuangan/keuangan-data'
import { usePageSize } from '@/features/settings/usePageSize'

const FILTERS = [
  { value: 'all', label: 'Semua status' },
  { value: 'open', label: 'Belum bayar' },
  { value: 'partial', label: 'Sebagian' },
  { value: 'overdue', label: 'Terlambat' },
  { value: 'paid', label: 'Lunas' },
] as const

type Filter = (typeof FILTERS)[number]['value']
type UtangSortKey =
  | 'invoice'
  | 'supplier'
  | 'dueDate'
  | 'status'
  | 'amount'
  | 'sisa'

const STATUS_TONE: Record<PayableStatus, 'neutral' | 'good' | 'warn' | 'danger'> = {
  open: 'neutral',
  partial: 'warn',
  overdue: 'danger',
  paid: 'good',
}

export function UtangPage() {
  const PAGE_SIZE = usePageSize()
  const { payables, payPayable } = useFinanceStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<UtangSortKey> | null>({
    key: 'dueDate',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const [detail, setDetail] = useState<PayableRow | null>(null)
  const [payTarget, setPayTarget] = useState<PayableRow | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payReceipt, setPayReceipt] = useState<ReceiptValue>(null)
  const [payError, setPayError] = useState<string | null>(null)

  const stats = useMemo(() => buildUtangStats(payables), [payables])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = payables.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false
      if (dateFrom && row.dueDate < dateFrom) return false
      if (dateTo && row.dueDate > dateTo) return false
      if (!q) return true
      return (
        row.supplier.toLowerCase().includes(q) ||
        row.invoice.toLowerCase().includes(q) ||
        row.dueDate.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      invoice: (r) => r.invoice,
      supplier: (r) => r.supplier,
      dueDate: (r) => r.dueDate,
      status: (r) => r.status,
      amount: (r) => r.amount,
      sisa: (r) => r.amount - r.paid,
    })
  }, [payables, search, filter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: UtangSortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function openPay(row: PayableRow) {
    const sisa = row.amount - row.paid
    setPayTarget(row)
    setPayAmount(String(sisa))
    setPayNote('')
    setPayReceipt(null)
    setPayError(null)
  }

  function submitPay() {
    if (!payTarget) return
    const sisa = payTarget.amount - payTarget.paid
    const amount = parseIdrInput(payAmount)
    if (amount <= 0) {
      setPayError('Jumlah pembayaran harus lebih dari 0')
      return
    }
    if (amount > sisa) {
      setPayError(`Maksimal ${formatIdr(sisa)}`)
      return
    }

    const err = payPayable({
      id: payTarget.id,
      amount,
      invoice: payTarget.invoice,
      party: payTarget.supplier,
      note: payNote,
      receiptName: payReceipt?.name,
    })
    if (err) {
      setPayError(err)
      return
    }
    setPayTarget(null)
    setPayReceipt(null)
    setDetail(null)
    setToast(
      `Pembayaran ${formatIdr(amount)} untuk ${payTarget.invoice} dicatat · sinkron ke Kas${
        payReceipt ? ` · struk ${payReceipt.name}` : ''
      }`,
    )
  }

  function handlePrint(row: PayableRow) {
    const ok = printBukti(
      `Bukti utang ${row.invoice}`,
      [
        { label: 'Sisa utang', value: formatIdr(row.amount - row.paid) },
        { label: 'Pemasok', value: row.supplier },
        { label: 'Invoice', value: row.invoice },
        { label: 'Jatuh tempo', value: row.dueDate },
        { label: 'Nilai utang', value: formatIdr(row.amount) },
        { label: 'Sudah dibayar', value: formatIdr(row.paid) },
        { label: 'Status', value: PAYABLE_STATUS_LABEL[row.status] },
        { label: 'Struk', value: row.receiptName ?? '—' },
      ],
      { subtitle: row.supplier, module: 'Keuangan · Utang' },
    )
    if (!ok) setToast('Izinkan popup untuk mencetak')
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Utang pemasok</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Cari, lihat detail, dan catat pembayaran utang
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
          searchPlaceholder="Cari pemasok, invoice, jatuh tempo…"
          filter={filter}
          filterOptions={FILTERS}
          onFilterChange={(v) => {
            setFilter(v)
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
          actionLabel="+ Bayar utang"
          onAction={() => {
            const first = payables.find((r) => r.status !== 'paid')
            if (first) openPay(first)
            else setToast('Tidak ada utang terbuka')
          }}
        />

        <FinanceTable minWidth="800px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Invoice"
              sortKey="invoice"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Pemasok"
              sortKey="supplier"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Jatuh tempo"
              sortKey="dueDate"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Nilai"
              sortKey="amount"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Sisa"
              sortKey="sisa"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={8}
                message="Tidak ada utang yang cocok."
              />
            ) : (
              rows.map((row, index) => {
                const sisa = row.amount - row.paid
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {row.invoice}
                    </FinanceTd>
                    <FinanceTd className="font-medium">{row.supplier}</FinanceTd>
                    <FinanceTd mono muted>
                      {row.dueDate}
                      {row.agingDays > 0 ? (
                        <span className="mt-0.5 block font-sans text-[11px] text-red-700">
                          +{row.agingDays} hari
                        </span>
                      ) : null}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={PAYABLE_STATUS_LABEL[row.status]}
                        tone={STATUS_TONE[row.status]}
                      />
                    </FinanceTd>
                    <FinanceTd mono className="font-medium whitespace-nowrap">
                      {formatIdr(row.amount)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium whitespace-nowrap">
                      {formatIdr(sisa)}
                    </FinanceTd>
                    <FinanceTd align="center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setDetail(row)}
                          className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                          aria-label={`Detail ${row.invoice}`}
                          title="Detail"
                        >
                          <EyeIcon className="size-[18px]" />
                        </button>
                        {row.status !== 'paid' ? (
                          <button
                            type="button"
                            onClick={() => openPay(row)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            Bayar
                          </button>
                        ) : null}
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
        <UtangDetailDrawer
          row={detail}
          onClose={() => setDetail(null)}
          onPrint={() => handlePrint(detail)}
          onPay={() => {
            openPay(detail)
            setDetail(null)
          }}
        />
      ) : null}

      {payTarget ? (
        <FinanceModal
          title={`Bayar ${payTarget.invoice}`}
          subtitle={payTarget.supplier}
          onClose={() => {
            setPayTarget(null)
            setPayReceipt(null)
          }}
          wide
          footer={
            <ModalActions
              onCancel={() => {
                setPayTarget(null)
                setPayReceipt(null)
              }}
              onConfirm={submitPay}
              confirmLabel="Catat pembayaran"
            />
          }
        >
          <div className="space-y-3">
            <DetailFields
              fields={[
                {
                  label: 'Sisa utang',
                  value: formatIdr(payTarget.amount - payTarget.paid),
                },
              ]}
            />
            <TextField
              id="pay-amount"
              label="Jumlah bayar (Rp)"
              requiredMark
              inputMode="numeric"
              value={payAmount}
              error={payError ?? undefined}
              onChange={(e) => {
                setPayAmount(e.target.value)
                setPayError(null)
              }}
            />
            {parseIdrInput(payAmount) > 0 ? (
              <p className="font-mono text-[11px] text-muted">
                = {formatIdr(parseIdrInput(payAmount))}
              </p>
            ) : null}
            <TextAreaField
              id="pay-note"
              label="Catatan (opsional)"
              value={payNote}
              onChange={setPayNote}
              placeholder="No. transfer, bank, dll."
              rows={2}
            />
            <ReceiptUpload
              value={payReceipt}
              onChange={setPayReceipt}
              label="Nota / bukti pembayaran"
              requiredMark
            />
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}

function UtangDetailDrawer({
  row,
  onClose,
  onPrint,
  onPay,
}: {
  row: PayableRow
  onClose: () => void
  onPrint: () => void
  onPay: () => void
}) {
  const sisa = row.amount - row.paid
  const paidPct =
    row.amount > 0 ? Math.min(100, Math.round((row.paid / row.amount) * 100)) : 0
  const heroTone =
    row.status === 'paid'
      ? 'good'
      : row.status === 'overdue'
        ? 'danger'
        : row.status === 'partial'
          ? 'warn'
          : 'default'

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={row.invoice}
      subtitle={`Jatuh tempo ${row.dueDate}`}
      badge={
        <StatusPill
          label={PAYABLE_STATUS_LABEL[row.status]}
          tone={STATUS_TONE[row.status]}
        />
      }
      footer={
        <>
          {row.status !== 'paid' ? (
            <button
              type="button"
              onClick={onPay}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Bayar utang
            </button>
          ) : (
            <p className="text-center text-[13px] text-brand-800">
              Utang sudah lunas.
            </p>
          )}
          <button
            type="button"
            onClick={onPrint}
            className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
          >
            Cetak bukti
          </button>
        </>
      }
    >
      <DrawerHero
        label="Sisa utang"
        amount={sisa === 0 ? 'Lunas' : formatIdr(sisa)}
        tone={heroTone}
        hint={`Total ${formatIdr(row.amount)} · dibayar ${formatIdr(row.paid)}`}
      />

      <div className="mb-4 rounded-2xl border border-line/80 bg-surface/80 px-3.5 py-3">
        <p className="text-[12px] text-muted">Pemasok</p>
        <p className="mt-1 text-[14px] font-medium text-ink">{row.supplier}</p>
        {row.agingDays > 0 ? (
          <p className="mt-1.5 text-[12px] font-medium text-red-700">
            Terlambat {row.agingDays} hari
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] text-muted">Belum lewat jatuh tempo</p>
        )}
      </div>

      <DrawerSection label="Progress pelunasan">
        <div className="rounded-xl border border-line/80 bg-surface/70 px-3 py-3">
          <div className="mb-2 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-muted">Terbayar</span>
            <span className="num font-semibold text-ink">{paidPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line/70">
            <div
              className={[
                'h-full rounded-full transition-[width]',
                row.status === 'overdue' ? 'bg-red-500' : 'bg-brand-600',
              ].join(' ')}
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between gap-2 font-mono text-[11px] text-muted">
            <span>{formatIdr(row.paid)}</span>
            <span>{formatIdr(row.amount)}</span>
          </div>
        </div>
      </DrawerSection>

      <DrawerSection label="Rincian">
        <DrawerFacts
          items={[
            ['Invoice', row.invoice],
            ['Jatuh tempo', row.dueDate],
            ['Nilai utang', formatIdr(row.amount)],
            ['Sudah dibayar', formatIdr(row.paid)],
            ['Sisa', formatIdr(sisa)],
            [
              'Aging',
              row.agingDays > 0
                ? `${row.agingDays} hari terlambat`
                : 'Tepat waktu',
            ],
          ]}
        />
      </DrawerSection>

      <DrawerSection label="Bukti">
        {row.receiptName ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2.5">
            <p className="text-[11px] text-muted">Struk terakhir</p>
            <p className="num mt-1 truncate text-[13px] font-medium text-brand-900">
              {row.receiptName}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[13px] text-muted">
            Belum ada bukti pembayaran. Lampirkan saat bayar.
          </p>
        )}
      </DrawerSection>
    </DetailDrawer>
  )
}
