import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { DetailFields, FinanceModal } from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import {
  ReceiptUpload,
  receiptPersistRef,
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
import { TaxPostFields } from '@/components/keuangan/TaxPostFields'
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
import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'
import { useTaxStore } from '@/features/keuangan/tax-store'
import type { PenjualanActionResult } from '@/features/penjualan/PenjualanContext'
import { useProduksi } from '@/features/produksi/ProduksiContext'
import {
  PAYMENT_METHOD_LABEL,
  SETTLEMENT_LABEL,
  STAGE_LABEL,
  formatDate,
  formatQty,
  formatRupiah,
  formatRupiahShort,
  getCustomer,
  resolveSaleTaxDefaults,
  summarize,
  type DeliveryInput,
  type PaymentMethod,
  type SaleOrder,
  type SettlementMode,
} from '@/features/penjualan/penjualan-data'
import { usePageSize } from '@/features/settings/usePageSize'

const SETTLEMENT_OPTIONS = (Object.keys(SETTLEMENT_LABEL) as SettlementMode[]).map(
  (value) => ({
    value,
    label: SETTLEMENT_LABEL[value],
    description:
      value === 'lunas'
        ? 'Wajib lampirkan nota / bukti bayar'
        : 'Barang dikirim dulu, bayar nanti (piutang)',
  }),
)

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(
  (m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }),
)

const FILTERS = [
  { value: 'antre' as const, label: 'Antre pengiriman' },
  { value: 'selesai' as const, label: 'Sudah dikirim' },
  { value: 'semua' as const, label: 'Semua status' },
]

const SETTLEMENT_FILTERS = [
  { value: 'semua' as const, label: 'Semua cara bayar' },
  { value: 'lunas' as const, label: 'Lunas saat kirim' },
  { value: 'kredit' as const, label: 'Kredit / tempo' },
]

type QueueFilter = (typeof FILTERS)[number]['value']
type SettlementFilter = (typeof SETTLEMENT_FILTERS)[number]['value']
type SortKey = 'id' | 'customer' | 'product' | 'date' | 'total' | 'stage'

type PengirimanViewProps = {
  orders: SaleOrder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onShip: (id: string, input: DeliveryInput) => PenjualanActionResult
  onGoTo: (tab: 'tagihan', id: string) => void
}

export function PengirimanView({
  orders,
  selectedId,
  onSelect,
  onShip,
  onGoTo,
}: PengirimanViewProps) {
  const PAGE_SIZE = usePageSize()
  const { settings } = useTaxStore()
  const { lotCosts } = useProduksi()
  const lotOptions = useMemo(
    () =>
      lotCosts
        .filter((l) => l.costPerKgBeras > 0)
        .map((l) => ({
          value: l.lotId,
          label: l.lotId,
          description: `${formatRupiah(l.costPerKgBeras)}/kg · batch ${l.batchId}`,
        })),
    [lotCosts],
  )
  const waiting = useMemo(() => orders.filter((o) => o.stage === 'dibuat'), [orders])
  const shipped = useMemo(
    () => orders.filter((o) => o.stage === 'dikirim' && o.delivery?.shippedAt),
    [orders],
  )

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<QueueFilter>(
    waiting.length > 0 ? 'antre' : 'selesai',
  )
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>('semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [work, setWork] = useState<SaleOrder | null>(null)
  const [detail, setDetail] = useState<SaleOrder | null>(null)
  const [vehicle, setVehicle] = useState('')
  const [driver, setDriver] = useState('')
  const [note, setNote] = useState('')
  const [settlement, setSettlement] = useState<SettlementMode>('lunas')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('tunai')
  const [shipReceipt, setShipReceipt] = useState<ReceiptValue>(null)
  const [payReceipt, setPayReceipt] = useState<ReceiptValue>(null)
  const [shipReceiptError, setShipReceiptError] = useState<string>()
  const [payReceiptError, setPayReceiptError] = useState<string>()
  const [settlementError, setSettlementError] = useState<string>()
  const [lotId, setLotId] = useState('')
  const [lotError, setLotError] = useState<string>()
  const [ppnRate, setPpnRate] = useState<PpnRate>(
    () => resolveSaleTaxDefaults(settings).ppnRate,
  )
  const [priceMode, setPriceMode] = useState<PriceMode>(
    () => resolveSaleTaxDefaults(settings).priceMode,
  )

  const stats: MetricCardData[] = [
    {
      label: 'Antre kirim',
      value: String(waiting.length),
      delta: waiting.length > 0 ? 'Siap diproses' : 'Kosong',
      positive: waiting.length === 0,
      spark: [2, 3, 2, 3, 2, 2, 3],
    },
    {
      label: 'Sudah dikirim',
      value: String(shipped.length),
      delta: 'Dengan surat jalan',
      positive: true,
      spark: [1, 2, 2, 3, 3, 4, 4],
    },
    {
      label: 'Nilai antre',
      value: formatRupiahShort(
        waiting.reduce((sum, o) => sum + summarize(o).total, 0),
      ),
      delta: `${waiting.length} order`,
      positive: waiting.length === 0,
      spark: [30, 32, 28, 35, 40, 38, 36],
    },
    {
      label: 'Total order',
      value: String(orders.length),
      delta: 'Semua tahap',
      positive: true,
      spark: [5, 6, 6, 7, 7, 8, 8],
    },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = orders.filter((o) => {
      if (filter === 'antre' && o.stage !== 'dibuat') return false
      if (filter === 'selesai' && o.stage !== 'dikirim') return false
      if (settlementFilter !== 'semua') {
        if (o.stage !== 'dikirim') return false
        if (o.delivery?.settlement !== settlementFilter) return false
      }
      if (dateFrom && o.date < dateFrom) return false
      if (dateTo && o.date > dateTo) return false
      if (!q) return true
      const c = getCustomer(o.customerId)
      return [o.id, c?.name, o.productName, o.sku, o.delivery?.vehicle].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (o) => o.id,
      customer: (o) => getCustomer(o.customerId)?.name ?? '',
      product: (o) => o.productName,
      date: (o) => o.delivery?.shippedAt ?? o.date,
      total: (o) => summarize(o).total,
      stage: (o) => o.stage,
    })
  }, [orders, search, filter, settlementFilter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  useEffect(() => {
    if (!selectedId) return
    const found = orders.find((o) => o.id === selectedId)
    if (found && found.stage === 'dibuat') openWork(found)
  }, [selectedId, orders])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function openWork(o: SaleOrder) {
    setWork(o)
    setVehicle(o.delivery?.vehicle ?? '')
    setDriver(o.delivery?.driver ?? '')
    setNote(o.delivery?.note ?? '')
    setSettlement(o.delivery?.settlement ?? 'lunas')
    setPayMethod(o.delivery?.payMethod ?? 'tunai')
    setShipReceipt(null)
    setPayReceipt(null)
    setShipReceiptError(undefined)
    setPayReceiptError(undefined)
    setSettlementError(undefined)
    setLotId('')
    setLotError(undefined)
    const tax = resolveSaleTaxDefaults(settings)
    setPpnRate(tax.ppnRate)
    setPriceMode(tax.priceMode)
    onSelect(o.id)
  }

  function closeWork() {
    setWork(null)
    setShipReceipt(null)
    setPayReceipt(null)
    onSelect(null)
  }

  function submitShip() {
    if (!work) return
    let ok = true
    if (!shipReceipt) {
      setShipReceiptError('Lampirkan surat jalan / bukti pengiriman')
      ok = false
    }
    if (settlement === 'lunas' && !payReceipt) {
      setPayReceiptError('Lampirkan nota / bukti pembayaran')
      ok = false
    }
    if (settlement === 'kredit' && !note.trim()) {
      setSettlementError('Isi catatan kredit (mis. tempo 7 hari / PO pelanggan)')
      ok = false
    }
    if (!lotId.trim()) {
      setLotError('Pilih lot costing untuk COGS pengiriman')
      ok = false
    }
    if (!ok) return

    const input: DeliveryInput = {
      lotId: lotId.trim(),
      vehicle: vehicle.trim() || undefined,
      driver: driver.trim() || undefined,
      note: note.trim() || undefined,
      receiptName: shipReceipt!.name,
      settlement,
      payMethod: settlement === 'lunas' ? payMethod : undefined,
      payReceiptName:
        settlement === 'lunas' ? receiptPersistRef(payReceipt) : undefined,
      ppnRate,
      priceMode,
    }
    const result = onShip(work.id, input)
    if (!result.ok) {
      setToast(result.error)
      return
    }
    if (result.journalError) {
      setToast(`Dikirim, tetapi jurnal gagal: ${result.journalError}`)
    } else {
      setToast(
        settlement === 'lunas'
          ? `${work.id} dikirim · lunas · nota ${receiptPersistRef(payReceipt)}`
          : `${work.id} dikirim · kredit / tempo`,
      )
    }
    closeWork()
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Pengiriman</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Proses antrean order yang siap dikirim
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
          searchPlaceholder="Cari order, pelanggan, produk, nopol…"
          filter={filter}
          filterOptions={FILTERS}
          onFilterChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          secondaryFilter={settlementFilter}
          secondaryFilterOptions={SETTLEMENT_FILTERS}
          onSecondaryFilterChange={(v) => {
            setSettlementFilter(v)
            setPage(1)
          }}
          secondaryFilterLabel="Cara bayar"
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

        <FinanceTable minWidth="780px">
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
                const customer = getCustomer(o.customerId)
                const s = summarize(o)
                const dateShow = o.delivery?.shippedAt ?? o.date
                return (
                  <FinanceTr key={o.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {o.id}
                      {o.delivery?.settlement ? (
                        <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                          {o.delivery.settlement === 'lunas' ? 'Lunas' : 'Kredit'}
                        </span>
                      ) : null}
                    </FinanceTd>
                    <FinanceTd className="font-medium">{customer?.name}</FinanceTd>
                    <FinanceTd>
                      {o.productName}
                      <span className="num mt-0.5 block text-[11px] text-muted">
                        {formatQty(o.qty, o.unit)}
                      </span>
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {formatDate(dateShow)}
                    </FinanceTd>
                    <FinanceTd mono align="right" className="font-medium whitespace-nowrap">
                      {formatRupiah(s.total)}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={STAGE_LABEL[o.stage]}
                        tone={o.stage === 'dikirim' ? 'good' : 'neutral'}
                      />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setDetail(o)}
                          className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                          aria-label={`Detail ${o.id}`}
                          title="Detail"
                        >
                          <EyeIcon className="size-[18px]" />
                        </button>
                        {o.stage === 'dibuat' ? (
                          <button
                            type="button"
                            onClick={() => openWork(o)}
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
        <ShipDetailDrawer
          order={detail}
          onClose={() => setDetail(null)}
          onPrint={() => {
            if (!printShipment(detail)) setToast('Izinkan popup untuk mencetak')
          }}
        />
      ) : null}

      {work ? (
        <FinanceModal
          title={work.id}
          subtitle="Konfirmasi pengiriman"
          onClose={closeWork}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeWork}
                className="h-11 flex-1 rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitShip}
                className="h-11 flex-1 rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Konfirmasi kirim
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <DetailFields
              fields={[
                {
                  label: 'Pelanggan',
                  value: getCustomer(work.customerId)?.name ?? '—',
                },
                { label: 'Produk', value: `${work.productName} · ${work.sku}` },
                { label: 'Jumlah', value: formatQty(work.qty, work.unit) },
                { label: 'Nilai', value: formatRupiah(summarize(work).total) },
              ]}
            />

            <TaxPostFields
              subtotal={work.qty * work.price}
              rate={ppnRate}
              priceMode={priceMode}
              onRateChange={setPpnRate}
              onModeChange={setPriceMode}
            />

            <Select
              label="Lot costing (COGS)"
              requiredMark
              value={lotId}
              placeholder={
                lotOptions.length > 0
                  ? 'Pilih lot giling'
                  : 'Belum ada LotCost dengan cost/kg > 0'
              }
              options={lotOptions}
              onChange={(v) => {
                setLotId(v)
                setLotError(undefined)
              }}
            />
            {lotError ? (
              <p className="text-[12px] text-red-700">{lotError}</p>
            ) : null}

            <Select
              label="Cara bayar saat kirim"
              requiredMark
              value={settlement}
              options={SETTLEMENT_OPTIONS}
              onChange={(v) => {
                setSettlement(v)
                setSettlementError(undefined)
                setPayReceiptError(undefined)
              }}
            />

            {settlement === 'lunas' ? (
              <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
                <Select
                  label="Metode bayar"
                  value={payMethod}
                  options={METHOD_OPTIONS}
                  onChange={setPayMethod}
                />
                <ReceiptUpload
                  value={payReceipt}
                  onChange={(v) => {
                    setPayReceipt(v)
                    setPayReceiptError(undefined)
                  }}
                  label="Nota / bukti pembayaran"
                  requiredMark
                  error={payReceiptError}
                  hint="Wajib · foto nota tunai, struk transfer, atau kwitansi"
                />
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-[12.5px] leading-snug text-amber-900">
                  Order dicatat sebagai piutang (kredit/tempo). Jatuh tempo otomatis +7
                  hari setelah kirim.
                </p>
                <TextField
                  id="ship-credit-note"
                  label="Catatan kredit"
                  requiredMark
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    setSettlementError(undefined)
                  }}
                  placeholder="Mis. tempo 7 hari · PO-882 · bayar akhir bulan"
                  error={settlementError}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="ship-vehicle"
                label="Kendaraan"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="No. polisi"
              />
              <TextField
                id="ship-driver"
                label="Sopir"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                placeholder="Opsional"
              />
            </div>
            {settlement === 'lunas' ? (
              <TextField
                id="ship-note"
                label="Catatan pengiriman"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opsional"
              />
            ) : null}
            <ReceiptUpload
              value={shipReceipt}
              onChange={(v) => {
                setShipReceipt(v)
                setShipReceiptError(undefined)
              }}
              label="Surat jalan / bukti pengiriman"
              requiredMark
              error={shipReceiptError}
            />
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}

function printShipment(o: SaleOrder) {
  const customer = getCustomer(o.customerId)
  const s = summarize(o)
  return printBukti(
    `Bukti pengiriman ${o.id}`,
    [
      { label: 'Nilai order', value: formatRupiah(s.total) },
      { label: 'Pelanggan', value: customer?.name ?? '—' },
      { label: 'No. order', value: o.id },
      { label: 'Tanggal order', value: formatDate(o.date) },
      { label: 'Status', value: STAGE_LABEL[o.stage] },
      { label: 'Produk', value: `${o.productName} · ${o.sku}` },
      { label: 'Jumlah', value: formatQty(o.qty, o.unit) },
      o.delivery?.shippedAt
        ? { label: 'Dikirim', value: formatDate(o.delivery.shippedAt) }
        : { label: 'Pengiriman', value: 'Menunggu' },
    ],
    { subtitle: customer?.name, module: 'Penjualan · Pengiriman' },
  )
}

function ShipDetailDrawer({
  order: o,
  onClose,
  onPrint,
}: {
  order: SaleOrder
  onClose: () => void
  onPrint: () => void
}) {
  const customer = getCustomer(o.customerId)
  const s = summarize(o)

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={o.id}
      subtitle={`${customer?.name ?? '—'} · ${formatDate(o.date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}`}
      badge={
        <StatusPill
          label={STAGE_LABEL[o.stage]}
          tone={o.stage === 'dikirim' ? 'good' : 'neutral'}
        />
      }
      footer={
        <button
          type="button"
          onClick={onPrint}
          className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
        >
          Cetak bukti
        </button>
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
            o.delivery?.shippedAt
              ? ['Dikirim', formatDate(o.delivery.shippedAt)]
              : ['Status', 'Menunggu pengiriman'],
            o.delivery?.settlement
              ? ['Cara bayar', SETTLEMENT_LABEL[o.delivery.settlement]]
              : null,
            o.delivery?.payMethod
              ? ['Metode', PAYMENT_METHOD_LABEL[o.delivery.payMethod]]
              : null,
            o.delivery?.payReceiptName
              ? ['Nota / bukti bayar', o.delivery.payReceiptName]
              : null,
            o.delivery?.vehicle ? ['Kendaraan', o.delivery.vehicle] : null,
            o.delivery?.driver ? ['Sopir', o.delivery.driver] : null,
            o.delivery?.receiptName
              ? ['Surat jalan', o.delivery.receiptName]
              : null,
            o.delivery?.note ? ['Catatan', o.delivery.note] : null,
            o.lotId ? ['Lot costing', o.lotId] : null,
          ]}
        />
      </DrawerSection>
    </DetailDrawer>
  )
}
