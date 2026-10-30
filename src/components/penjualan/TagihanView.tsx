import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { FinanceModal } from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import {
  ReceiptUpload,
  type ReceiptValue,
} from '@/components/keuangan/ReceiptUpload'
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
import { printBukti } from '@/components/keuangan/print-bukti'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatDate,
  formatQty,
  formatRupiah,
  formatRupiahShort,
  getCustomer,
  parseNumber,
  summarize,
  todayIso,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type SaleOrder,
} from '@/features/penjualan/penjualan-data'
import { usePageSize } from '@/features/settings/usePageSize'

const FILTERS = [
  { value: 'belum-lunas' as const, label: 'Belum lunas' },
  { value: 'terlambat' as const, label: 'Lewat jatuh tempo' },
  { value: 'lunas' as const, label: 'Lunas' },
  { value: 'semua' as const, label: 'Semua status' },
]

type PayFilter = (typeof FILTERS)[number]['value']
type SortKey = 'id' | 'customer' | 'due' | 'total' | 'sisa' | 'status'

const STATUS_TONE: Record<PaymentStatus, 'neutral' | 'good' | 'warn' | 'danger'> = {
  belum: 'neutral',
  sebagian: 'warn',
  lunas: 'good',
  terlambat: 'danger',
}

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({
  value: m,
  label: PAYMENT_METHOD_LABEL[m],
}))

type Row = { o: SaleOrder; s: ReturnType<typeof summarize> }

function buildStats(rows: Row[]): MetricCardData[] {
  const open = rows.filter((x) => x.s.outstanding > 0)
  const overdue = rows.filter((x) => x.s.payment === 'terlambat')
  const outstanding = open.reduce((sum, x) => sum + x.s.outstanding, 0)
  const paid = rows.reduce((sum, x) => sum + x.s.paid, 0)
  return [
    {
      label: 'Total tagihan',
      value: String(rows.length),
      delta: `${rows.length} dok`,
      positive: true,
      spark: [4, 5, 5, 6, 6, 7, 7],
    },
    {
      label: 'Belum lunas',
      value: String(open.length),
      delta: open.length > 0 ? 'Perlu bayar' : 'Kosong',
      positive: open.length === 0,
      spark: [3, 3, 4, 3, 2, 3, 2],
    },
    {
      label: 'Terlambat',
      value: String(overdue.length),
      delta: overdue.length > 0 ? `+${overdue.length}` : '0',
      positive: overdue.length === 0,
      spark: [1, 1, 2, 1, 2, 1, 1],
    },
    {
      label: 'Sisa piutang',
      value: formatRupiahShort(outstanding),
      delta: paid > 0 ? `terbayar ${formatRupiahShort(paid)}` : '0',
      positive: outstanding === 0,
      spark: [50, 48, 52, 55, 53, 50, 48],
    },
  ]
}

type TagihanViewProps = {
  orders: SaleOrder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onPay: (id: string, payment: Omit<Payment, 'id'>) => void
}

export function TagihanView({ orders, selectedId, onSelect, onPay }: TagihanViewProps) {
  const PAGE_SIZE = usePageSize()
  const today = todayIso()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PayFilter>('belum-lunas')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'due',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [detail, setDetail] = useState<SaleOrder | null>(null)
  const [payTarget, setPayTarget] = useState<SaleOrder | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [date, setDate] = useState(today)
  const [receipt, setReceipt] = useState<ReceiptValue>(null)
  const [error, setError] = useState<string>()
  const [receiptError, setReceiptError] = useState<string>()

  const invoices = useMemo(
    () =>
      orders
        .filter((o) => o.stage === 'dikirim')
        .map((o) => ({ o, s: summarize(o, today) })),
    [orders, today],
  )

  const stats = useMemo(() => buildStats(invoices), [invoices])

  const matches = (status: PaymentStatus | null, f: PayFilter) =>
    f === 'semua' ||
    (f === 'lunas' && status === 'lunas') ||
    (f === 'terlambat' && status === 'terlambat') ||
    (f === 'belum-lunas' && status !== 'lunas')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = invoices.filter((x) => {
      if (!matches(x.s.payment, filter)) return false
      const due = x.o.dueDate ?? x.o.date
      if (dateFrom && due < dateFrom) return false
      if (dateTo && due > dateTo) return false
      if (!q) return true
      const c = getCustomer(x.o.customerId)
      return [x.o.id, c?.name, x.o.productName].some((v) => v?.toLowerCase().includes(q))
    })
    return sortBy(base, sort, {
      id: (x) => x.o.id,
      customer: (x) => getCustomer(x.o.customerId)?.name ?? '',
      due: (x) => x.o.dueDate ?? '',
      total: (x) => x.s.total,
      sisa: (x) => x.s.outstanding,
      status: (x) => x.s.payment ?? '',
    })
  }, [invoices, search, filter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (!selectedId) return
    const found = invoices.find((x) => x.o.id === selectedId)?.o
    if (found) setDetail(found)
  }, [selectedId, invoices])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openPay(o: SaleOrder) {
    const s = summarize(o, today)
    setPayTarget(o)
    setAmount(String(s.outstanding))
    setMethod('transfer')
    setDate(today)
    setReceipt(null)
    setError(undefined)
    setReceiptError(undefined)
  }

  function submitPay() {
    if (!payTarget) return
    const s = summarize(payTarget, today)
    const value = parseNumber(amount)
    if (value <= 0) return setError('Isi jumlah pembayaran')
    if (value > s.outstanding) return setError(`Maksimal ${formatRupiah(s.outstanding)}`)
    if (!receipt) return setReceiptError('Lampirkan bukti pembayaran (foto/galeri)')
    onPay(payTarget.id, {
      amount: value,
      method,
      date,
      receiptName: receipt.name,
    })
    setPayTarget(null)
    setReceipt(null)
    setDetail(null)
    onSelect(payTarget.id)
    setToast(`Pembayaran ${formatRupiah(value)} dicatat · bukti ${receipt.name}`)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Tagihan pelanggan</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Piutang muncul setelah pengiriman — catat pembayaran di sini
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
          searchPlaceholder="Cari dokumen atau pelanggan…"
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
        />

        <FinanceTable minWidth="840px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Dokumen" sortKey="id" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Pelanggan"
              sortKey="customer"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Jatuh tempo"
              sortKey="due"
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
              label="Total"
              sortKey="total"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <FinanceSortTh
              label="Sisa"
              sortKey="sisa"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <FinanceTh align="center" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Tidak ada tagihan yang cocok." />
            ) : (
              rows.map(({ o, s }, index) => (
                <FinanceTr key={o.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {o.id}
                    <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                      {formatQty(o.qty, o.unit)}
                    </span>
                  </FinanceTd>
                  <FinanceTd className="font-medium">
                    {getCustomer(o.customerId)?.name}
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {o.dueDate ? formatDate(o.dueDate) : '—'}
                  </FinanceTd>
                  <FinanceTd>
                    {s.payment ? (
                      <StatusPill
                        label={PAYMENT_STATUS_LABEL[s.payment]}
                        tone={STATUS_TONE[s.payment]}
                      />
                    ) : null}
                  </FinanceTd>
                  <FinanceTd mono align="right" className="font-medium whitespace-nowrap">
                    {formatRupiah(s.total)}
                  </FinanceTd>
                  <FinanceTd
                    mono
                    align="right"
                    className={[
                      'font-medium whitespace-nowrap',
                      s.payment === 'terlambat' ? 'text-red-700' : '',
                    ].join(' ')}
                  >
                    {s.outstanding === 0 ? '—' : formatRupiah(s.outstanding)}
                  </FinanceTd>
                  <FinanceTd align="center">
                    <div className="inline-flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDetail(o)
                          onSelect(o.id)
                        }}
                        className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                        aria-label={`Detail ${o.id}`}
                        title="Detail"
                      >
                        <EyeIcon className="size-[18px]" />
                      </button>
                      {s.outstanding > 0 ? (
                        <button
                          type="button"
                          onClick={() => openPay(o)}
                          className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                        >
                          Bayar
                        </button>
                      ) : null}
                    </div>
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
        <InvoiceDetailDrawer
          order={detail}
          today={today}
          onClose={() => {
            setDetail(null)
            onSelect(null)
          }}
          onPrint={() => {
            if (!printInvoice(detail, today)) setToast('Izinkan popup untuk mencetak')
          }}
          onPay={() => {
            openPay(detail)
            setDetail(null)
          }}
        />
      ) : null}

      {payTarget ? (
        <FinanceModal
          title={payTarget.id}
          subtitle="Catat pembayaran"
          onClose={() => {
            setPayTarget(null)
            setReceipt(null)
          }}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayTarget(null)
                  setReceipt(null)
                }}
                className="h-11 flex-1 rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitPay}
                className="h-11 flex-1 rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Simpan
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-[13px] text-muted">
              Sisa:{' '}
              <span className="num font-semibold text-ink">
                {formatRupiah(summarize(payTarget, today).outstanding)}
              </span>
            </p>
            <TextField
              id="pay-amount"
              label="Jumlah (Rp)"
              requiredMark
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setError(undefined)
              }}
              error={error}
              trailing={
                <button
                  type="button"
                  onClick={() =>
                    setAmount(String(summarize(payTarget, today).outstanding))
                  }
                  className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
                >
                  Lunasi
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Metode"
                value={method}
                options={METHOD_OPTIONS}
                onChange={setMethod}
              />
              <TextField
                id="pay-date"
                label="Tanggal"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <ReceiptUpload
              value={receipt}
              onChange={(v) => {
                setReceipt(v)
                setReceiptError(undefined)
              }}
              label="Bukti pembayaran"
              requiredMark
              error={receiptError}
            />
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}

function printInvoice(o: SaleOrder, today: string) {
  const customer = getCustomer(o.customerId)
  const s = summarize(o, today)
  return printBukti(
    `Bukti tagihan ${o.id}`,
    [
      {
        label: 'Sisa piutang',
        value: s.outstanding === 0 ? 'Lunas' : formatRupiah(s.outstanding),
      },
      { label: 'Pelanggan', value: customer?.name ?? '—' },
      { label: 'No. order', value: o.id },
      {
        label: 'Jatuh tempo',
        value: o.dueDate ? formatDate(o.dueDate) : '—',
      },
      { label: 'Total', value: formatRupiah(s.total) },
      { label: 'Terbayar', value: formatRupiah(s.paid) },
      s.payment
        ? { label: 'Status', value: PAYMENT_STATUS_LABEL[s.payment] }
        : { label: 'Status', value: '—' },
    ],
    { subtitle: customer?.name, module: 'Penjualan · Tagihan' },
  )
}

function InvoiceDetailDrawer({
  order: o,
  today,
  onClose,
  onPrint,
  onPay,
}: {
  order: SaleOrder
  today: string
  onClose: () => void
  onPrint: () => void
  onPay: () => void
}) {
  const s = summarize(o, today)
  const customer = getCustomer(o.customerId)
  const outstandingTone =
    s.payment === 'terlambat' ? 'danger' : s.outstanding === 0 ? 'good' : 'warn'

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={o.id}
      subtitle={`${customer?.name ?? '—'} · jatuh tempo ${
        o.dueDate
          ? formatDate(o.dueDate, { day: 'numeric', month: 'long', year: 'numeric' })
          : '—'
      }`}
      badge={
        s.payment ? (
          <StatusPill label={PAYMENT_STATUS_LABEL[s.payment]} tone={STATUS_TONE[s.payment]} />
        ) : null
      }
      footer={
        <>
          <button
            type="button"
            onClick={onPrint}
            className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
          >
            Cetak bukti
          </button>
          {s.outstanding > 0 ? (
            <button
              type="button"
              onClick={onPay}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Catat pembayaran
            </button>
          ) : (
            <p className="text-center text-[13px] text-brand-800">Tagihan sudah lunas.</p>
          )}
        </>
      }
    >
      <DrawerHero
        label="Sisa piutang"
        amount={s.outstanding === 0 ? 'Lunas' : formatRupiah(s.outstanding)}
        tone={outstandingTone}
        hint={`Total ${formatRupiah(s.total)} · terbayar ${formatRupiah(s.paid)}`}
      />

      <div className="mb-4 rounded-2xl border border-line/80 bg-surface/80 px-3.5 py-3">
        <p className="text-[13px] font-medium text-ink">{customer?.name}</p>
        <p className="mt-0.5 text-[12px] text-muted">{customer?.city}</p>
      </div>

      <DrawerSection label="Rincian tagihan">
        <DrawerFacts
          items={[
            ['Produk', `${o.productName} · ${o.sku}`],
            ['Jumlah', formatQty(o.qty, o.unit)],
            ['Harga', `${formatRupiah(o.price)}/${o.unit}`],
            [
              'Jatuh tempo',
              o.dueDate
                ? formatDate(o.dueDate, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—',
            ],
            o.delivery?.settlement
              ? [
                  'Cara bayar',
                  o.delivery.settlement === 'lunas'
                    ? 'Lunas saat kirim'
                    : 'Kredit / tempo',
                ]
              : null,
            o.delivery?.payReceiptName
              ? ['Nota / bukti bayar', o.delivery.payReceiptName]
              : null,
            o.delivery?.receiptName
              ? ['Surat jalan', o.delivery.receiptName]
              : null,
            o.delivery?.note ? ['Catatan', o.delivery.note] : null,
          ]}
        />
      </DrawerSection>

      <DrawerSection label="Riwayat pembayaran">
        {o.payments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[13px] text-muted">
            Belum ada pembayaran.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...o.payments].reverse().map((pay) => (
              <li
                key={pay.id}
                className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="num text-[13px] font-semibold text-ink">
                    {formatRupiah(pay.amount)}
                  </p>
                  <p className="num text-[11px] text-muted">{formatDate(pay.date)}</p>
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  {PAYMENT_METHOD_LABEL[pay.method]}
                  {pay.receiptName ? ` · bukti ${pay.receiptName}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>
    </DetailDrawer>
  )
}
