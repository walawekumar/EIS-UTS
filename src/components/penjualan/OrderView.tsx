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
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import {
  PAYMENT_STATUS_LABEL,
  STAGE_LABEL,
  formatDate,
  formatQty,
  formatRupiah,
  formatRupiahShort,
  getCustomer,
  summarize,
  type OrderStage,
  type SaleOrder,
} from '@/features/penjualan/penjualan-data'
import { usePageSize } from '@/features/settings/usePageSize'

const FILTERS = [
  { value: 'semua' as const, label: 'Semua status' },
  { value: 'dibuat' as const, label: STAGE_LABEL.dibuat },
  { value: 'dikirim' as const, label: STAGE_LABEL.dikirim },
]

type StageFilter = (typeof FILTERS)[number]['value']
type SortKey = 'id' | 'customer' | 'product' | 'date' | 'total' | 'stage'

const STAGE_TONE: Record<OrderStage, 'neutral' | 'good'> = {
  dibuat: 'neutral',
  dikirim: 'good',
}

function spark(values: number[]) {
  return values
}

function buildStats(orders: SaleOrder[]): MetricCardData[] {
  const open = orders.filter((o) => o.stage === 'dibuat')
  const shipped = orders.filter((o) => o.stage === 'dikirim')
  const openValue = open.reduce((s, o) => s + summarize(o).total, 0)
  return [
    {
      label: 'Total order',
      value: String(orders.length),
      delta: `${orders.length} dok`,
      positive: true,
      spark: spark([4, 5, 5, 6, 6, 7, 7]),
    },
    {
      label: 'Belum dikirim',
      value: String(open.length),
      delta: open.length > 0 ? 'Siap kirim' : 'Kosong',
      positive: open.length === 0,
      spark: spark([3, 2, 3, 2, 2, 3, 2]),
    },
    {
      label: 'Sudah dikirim',
      value: String(shipped.length),
      delta: '+ok',
      positive: true,
      spark: spark([2, 3, 3, 4, 4, 5, 5]),
    },
    {
      label: 'Nilai terbuka',
      value: formatRupiahShort(openValue),
      delta: open.length > 0 ? `${open.length} order` : '0',
      positive: openValue === 0,
      spark: spark([40, 42, 38, 45, 48, 50, 47]),
    },
  ]
}

type OrderViewProps = {
  orders: SaleOrder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onGoTo: (tab: 'pengiriman' | 'tagihan', id: string) => void
}

export function OrderView({
  orders,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onGoTo,
}: OrderViewProps) {
  const PAGE_SIZE = usePageSize()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StageFilter>('semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [detail, setDetail] = useState<SaleOrder | null>(null)

  const stats = useMemo(() => buildStats(orders), [orders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = orders.filter((o) => {
      if (filter !== 'semua' && o.stage !== filter) return false
      if (dateFrom && o.date < dateFrom) return false
      if (dateTo && o.date > dateTo) return false
      if (!q) return true
      const c = getCustomer(o.customerId)
      return [o.id, c?.name, c?.city, o.productName, o.sku].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (o) => o.id,
      customer: (o) => getCustomer(o.customerId)?.name ?? '',
      product: (o) => o.productName,
      date: (o) => o.date,
      total: (o) => summarize(o).total,
      stage: (o) => o.stage,
    })
  }, [orders, search, filter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (!selectedId) return
    const found = orders.find((o) => o.id === selectedId)
    if (found) setDetail(found)
  }, [selectedId, orders])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openDetail(order: SaleOrder) {
    setDetail(order)
    onSelect(order.id)
  }

  function closeDetail() {
    setDetail(null)
    onSelect(null)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Order penjualan</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Catat order, lalu lanjut ke pengiriman dan tagihan
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
          searchPlaceholder="Cari order, pelanggan, produk…"
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
          actionLabel="+ Buat order"
          onAction={onCreate}
        />

        <FinanceTable minWidth="820px">
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
              label="Produk"
              sortKey="product"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Tanggal"
              sortKey="date"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Nilai"
              sortKey="total"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <FinanceSortTh
              label="Status"
              sortKey="stage"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Tidak ada order yang cocok." />
            ) : (
              rows.map((o, index) => {
                const s = summarize(o)
                const customer = getCustomer(o.customerId)
                return (
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
                      {customer?.name}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted">
                        {customer?.city}
                      </span>
                    </FinanceTd>
                    <FinanceTd className="max-w-[160px] truncate">{o.productName}</FinanceTd>
                    <FinanceTd mono muted>
                      {formatDate(o.date)}
                    </FinanceTd>
                    <FinanceTd mono align="right" className="font-medium whitespace-nowrap">
                      {formatRupiah(s.total)}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill label={STAGE_LABEL[o.stage]} tone={STAGE_TONE[o.stage]} />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openDetail(o)}
                          className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                          aria-label={`Detail ${o.id}`}
                          title="Detail"
                        >
                          <EyeIcon className="size-[18px]" />
                        </button>
                        {o.stage === 'dibuat' ? (
                          <button
                            type="button"
                            onClick={() => onGoTo('pengiriman', o.id)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            Kirim
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onGoTo('tagihan', o.id)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            Tagihan
                          </button>
                        )}
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
        <OrderDetailDrawer
          order={detail}
          onClose={closeDetail}
          onPrint={() => {
            if (!printOrder(detail)) setToast('Izinkan popup untuk mencetak')
          }}
          onDelete={() => {
            onDelete(detail.id)
            closeDetail()
            setToast(`${detail.id} dibatalkan`)
          }}
          onGoTo={(tab) => {
            closeDetail()
            onGoTo(tab, detail.id)
          }}
        />
      ) : null}
    </div>
  )
}

function printOrder(o: SaleOrder) {
  const customer = getCustomer(o.customerId)
  const s = summarize(o)
  return printBukti(
    `Bukti order ${o.id}`,
    [
      { label: 'Nilai order', value: formatRupiah(s.total) },
      { label: 'Pelanggan', value: customer?.name ?? '—' },
      { label: 'No. order', value: o.id },
      { label: 'Tanggal', value: formatDate(o.date) },
      { label: 'Status', value: STAGE_LABEL[o.stage] },
      { label: 'Produk', value: `${o.productName} · ${o.sku}` },
      { label: 'Jumlah', value: formatQty(o.qty, o.unit) },
      s.payment
        ? { label: 'Pembayaran', value: PAYMENT_STATUS_LABEL[s.payment] }
        : { label: 'Pembayaran', value: '—' },
    ],
    { subtitle: customer?.name, module: 'Penjualan' },
  )
}

function OrderDetailDrawer({
  order: o,
  onClose,
  onPrint,
  onDelete,
  onGoTo,
}: {
  order: SaleOrder
  onClose: () => void
  onPrint: () => void
  onDelete: () => void
  onGoTo: (tab: 'pengiriman' | 'tagihan') => void
}) {
  const s = summarize(o)
  const customer = getCustomer(o.customerId)
  const steps = [
    {
      label: 'Order dibuat',
      meta: formatDate(o.date, { day: 'numeric', month: 'long', year: 'numeric' }),
      done: true,
    },
    {
      label: 'Barang dikirim',
      meta: o.delivery?.shippedAt
        ? `${formatDate(o.delivery.shippedAt)}${o.delivery.vehicle ? ` · ${o.delivery.vehicle}` : ''}${o.delivery.receiptName ? ` · bukti ${o.delivery.receiptName}` : ''}`
        : 'Menunggu pengiriman',
      done: o.stage === 'dikirim',
    },
    {
      label: 'Tagihan lunas',
      meta:
        s.payment === 'lunas'
          ? 'Sudah lunas'
          : o.stage === 'dikirim'
            ? `Sisa ${formatRupiah(s.outstanding)}`
            : 'Setelah dikirim',
      done: s.payment === 'lunas',
    },
  ]
  const current = steps.findIndex((step) => !step.done)

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={o.id}
      subtitle={`${customer?.name ?? '—'} · ${formatDate(o.date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`}
      badge={
        <StatusPill label={STAGE_LABEL[o.stage]} tone={STAGE_TONE[o.stage]} />
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
          {o.stage === 'dibuat' ? (
            <>
              <button
                type="button"
                onClick={() => onGoTo('pengiriman')}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Lanjut pengiriman →
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-red-700 transition hover:bg-red-50"
              >
                Batalkan order
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onGoTo('tagihan')}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Lihat tagihan →
            </button>
          )}
        </>
      }
    >
      <DrawerHero label="Nilai order" amount={formatRupiah(s.total)} />

      <div className="mb-4 rounded-2xl border border-line/80 bg-surface/80 px-3.5 py-3">
        <p className="text-[13px] font-medium text-ink">{customer?.name}</p>
        <p className="mt-0.5 text-[12px] text-muted">{customer?.city}</p>
      </div>

      <DrawerSection label="Rincian">
        <DrawerFacts
          items={[
            ['Produk', `${o.productName} · ${o.sku}`],
            ['Jumlah', formatQty(o.qty, o.unit)],
            ['Harga', `${formatRupiah(o.price)}/${o.unit}`],
            ['Status', STAGE_LABEL[o.stage]],
            o.delivery?.settlement
              ? [
                  'Cara bayar',
                  o.delivery.settlement === 'lunas'
                    ? 'Lunas (sudah dibayar)'
                    : 'Kredit / tempo',
                ]
              : null,
            o.delivery?.payReceiptName
              ? ['Nota / bukti bayar', o.delivery.payReceiptName]
              : null,
            o.delivery?.receiptName
              ? ['Surat jalan', o.delivery.receiptName]
              : null,
            o.delivery?.note ? ['Catatan kirim', o.delivery.note] : null,
            o.note ? ['Catatan order', o.note] : null,
          ]}
        />
      </DrawerSection>

      <DrawerSection label="Alur dokumen">
        <ol>
          {steps.map((step, i) => {
            const isCurrent = i === current
            return (
              <li key={step.label} className="relative flex gap-3 pb-3 last:pb-0">
                {i < steps.length - 1 ? (
                  <span
                    className={[
                      'absolute top-7 bottom-0 left-[11px] w-px',
                      step.done ? 'bg-brand-300' : 'bg-line',
                    ].join(' ')}
                  />
                ) : null}
                <span
                  className={[
                    'relative flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    step.done
                      ? 'bg-brand-700 text-white'
                      : isCurrent
                        ? 'border-2 border-brand-600 bg-white text-brand-800'
                        : 'border border-line bg-white text-muted',
                  ].join(' ')}
                >
                  {step.done ? '✓' : i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={[
                      'text-[13px]',
                      step.done || isCurrent ? 'font-medium text-ink' : 'text-muted',
                    ].join(' ')}
                  >
                    {step.label}
                  </p>
                  <p className="num mt-0.5 text-[11px] text-muted">{step.meta}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </DrawerSection>
    </DetailDrawer>
  )
}
