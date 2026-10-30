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
  GRAIN_STANDARD,
  STAGE_LABEL,
  canHardDeletePurchase,
  formatDate,
  formatKg,
  formatRupiah,
  formatRupiahShort,
  getSupplier,
  isPurchaseAwaitingWeigh,
  isPurchaseReceivedForAp,
  summarize,
  type GrainType,
  type Purchase,
  type PurchaseStage,
} from '@/features/pembelian/pembelian-data'
import { usePageSize } from '@/features/settings/usePageSize'

const STAGE_FILTER_VALUES = [
  'draft',
  'diajukan',
  'disetujui',
  'ditolak',
  'ditimbang',
  'menunggu_selesai',
  'selesai',
] as const satisfies readonly PurchaseStage[]

const FILTERS = [
  { value: 'semua' as const, label: 'Semua status' },
  ...STAGE_FILTER_VALUES.map((value) => ({
    value,
    label: STAGE_LABEL[value],
  })),
]

const GRAIN_FILTERS = [
  { value: 'semua' as const, label: 'Semua jenis' },
  { value: 'GKP' as const, label: 'GKP' },
  { value: 'GKG' as const, label: 'GKG' },
]

type StageFilter = (typeof FILTERS)[number]['value']
type GrainFilter = (typeof GRAIN_FILTERS)[number]['value']
type SortKey = 'id' | 'supplier' | 'date' | 'value' | 'stage'

const STAGE_TONE: Record<PurchaseStage, 'neutral' | 'warn' | 'good'> = {
  draft: 'neutral',
  diajukan: 'neutral',
  disetujui: 'neutral',
  ditolak: 'warn',
  ditimbang: 'warn',
  menunggu_selesai: 'warn',
  selesai: 'good',
}

function buildStats(purchases: Purchase[]): MetricCardData[] {
  const waiting = purchases.filter((p) => isPurchaseAwaitingWeigh(p.stage))
  const confirm = purchases.filter((p) => p.stage === 'ditimbang')
  const openValue = [...waiting, ...confirm].reduce(
    (s, p) => s + summarize(p).estimatedValue,
    0,
  )
  return [
    {
      label: 'Total dokumen',
      value: String(purchases.length),
      delta: `${purchases.length} dok`,
      positive: true,
      spark: [5, 6, 6, 7, 8, 8, 9],
    },
    {
      label: 'Belum ditimbang',
      value: String(waiting.length),
      delta: waiting.length > 0 ? 'Antre' : 'Kosong',
      positive: waiting.length === 0,
      spark: [3, 3, 2, 3, 2, 2, 3],
    },
    {
      label: 'Menunggu konfirmasi',
      value: String(confirm.length),
      delta: confirm.length > 0 ? 'Perlu aksi' : '0',
      positive: confirm.length === 0,
      spark: [1, 2, 1, 2, 2, 1, 2],
    },
    {
      label: 'Nilai terbuka',
      value: formatRupiahShort(openValue),
      delta: `${waiting.length + confirm.length} dok`,
      positive: openValue === 0,
      spark: [40, 45, 42, 48, 50, 52, 49],
    },
  ]
}

type PencatatanViewProps = {
  purchases: Purchase[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onGoTo: (tab: 'penerimaan' | 'pembayaran', id: string) => void
}

export function PencatatanView({
  purchases,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onGoTo,
}: PencatatanViewProps) {
  const PAGE_SIZE = usePageSize()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StageFilter>('semua')
  const [grainFilter, setGrainFilter] = useState<GrainFilter>('semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [detail, setDetail] = useState<Purchase | null>(null)

  const stats = useMemo(() => buildStats(purchases), [purchases])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = purchases.filter((p) => {
      if (filter !== 'semua' && p.stage !== filter) return false
      if (grainFilter !== 'semua' && p.grain !== (grainFilter as GrainType))
        return false
      if (dateFrom && p.date < dateFrom) return false
      if (dateTo && p.date > dateTo) return false
      if (!q) return true
      const s = getSupplier(p.supplierId)
      return [p.id, s?.name, s?.village, p.vehicle, p.grain].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (p) => p.id,
      supplier: (p) => getSupplier(p.supplierId)?.name ?? '',
      date: (p) => p.date,
      value: (p) =>
        isPurchaseReceivedForAp(p.stage)
          ? summarize(p).total
          : summarize(p).estimatedValue,
      stage: (p) => p.stage,
    })
  }, [purchases, search, filter, grainFilter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (!selectedId) return
    const found = purchases.find((p) => p.id === selectedId)
    if (found) setDetail(found)
  }, [selectedId, purchases])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openDetail(p: Purchase) {
    setDetail(p)
    onSelect(p.id)
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
            <h2 className="text-[14px] font-semibold text-ink">Catatan pembelian</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Catat pembelian gabah — lanjut ke penerimaan dan pembayaran
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
          searchPlaceholder="Cari dokumen, pemasok, no. polisi…"
          filter={filter}
          filterOptions={FILTERS}
          onFilterChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          secondaryFilter={grainFilter}
          secondaryFilterOptions={GRAIN_FILTERS}
          onSecondaryFilterChange={(v) => {
            setGrainFilter(v)
            setPage(1)
          }}
          secondaryFilterLabel="Jenis gabah"
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
          actionLabel="+ Catat pembelian"
          onAction={onCreate}
        />

        <FinanceTable minWidth="860px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Dokumen" sortKey="id" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Pemasok"
              sortKey="supplier"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh>Jenis</FinanceTh>
            <FinanceSortTh
              label="Tanggal"
              sortKey="date"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Nilai"
              sortKey="value"
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
              <FinanceEmptyRow colSpan={8} message="Tidak ada catatan yang cocok." />
            ) : (
              rows.map((p, index) => {
                const s = summarize(p)
                const supplier = getSupplier(p.supplierId)
                const value = isPurchaseReceivedForAp(p.stage)
                  ? s.total
                  : s.estimatedValue
                return (
                  <FinanceTr key={p.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {p.id}
                      <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                        {p.sacks} karung · ±{formatKg(p.estimatedKg)}
                      </span>
                    </FinanceTd>
                    <FinanceTd className="font-medium">
                      {supplier?.name}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted">
                        {supplier?.village}
                      </span>
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {p.grain}
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {formatDate(p.date)}
                    </FinanceTd>
                    <FinanceTd mono align="right" className="font-medium whitespace-nowrap">
                      {formatRupiah(value)}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill label={STAGE_LABEL[p.stage]} tone={STAGE_TONE[p.stage]} />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openDetail(p)}
                          className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                          aria-label={`Detail ${p.id}`}
                          title="Detail"
                        >
                          <EyeIcon className="size-[18px]" />
                        </button>
                        {!isPurchaseReceivedForAp(p.stage) ? (
                          <button
                            type="button"
                            onClick={() => onGoTo('penerimaan', p.id)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            Timbang
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onGoTo('pembayaran', p.id)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            Bayar
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
        <PurchaseDetailDrawer
          purchase={detail}
          onClose={closeDetail}
          onPrint={() => {
            if (!printPurchase(detail)) setToast('Izinkan popup untuk mencetak')
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

function printPurchase(p: Purchase) {
  const supplier = getSupplier(p.supplierId)
  const s = summarize(p)
  const value = isPurchaseReceivedForAp(p.stage) ? s.total : s.estimatedValue
  return printBukti(
    `Bukti pembelian ${p.id}`,
    [
      { label: 'Nilai', value: formatRupiah(value) },
      { label: 'Pemasok', value: supplier?.name ?? '—' },
      { label: 'No. dokumen', value: p.id },
      { label: 'Tanggal', value: formatDate(p.date) },
      { label: 'Status', value: STAGE_LABEL[p.stage] },
      { label: 'Gabah', value: `${p.grain} · ${GRAIN_STANDARD[p.grain].label}` },
      { label: 'Karung', value: `${p.sacks} karung` },
      s.weighing
        ? { label: 'Netto', value: formatKg(s.weighing.netto) }
        : { label: 'Taksiran', value: formatKg(p.estimatedKg) },
    ],
    { subtitle: supplier?.name, module: 'Pembelian' },
  )
}

function PurchaseDetailDrawer({
  purchase: p,
  onClose,
  onPrint,
  onDelete,
  onGoTo,
}: {
  purchase: Purchase
  onClose: () => void
  onPrint: () => void
  onDelete: () => void
  onGoTo: (tab: 'penerimaan' | 'pembayaran') => void
}) {
  const s = summarize(p)
  const supplier = getSupplier(p.supplierId)
  const lastPayment = p.payments.at(-1)

  const steps = [
    {
      label: 'Pembelian dicatat',
      meta: formatDate(p.date, { day: 'numeric', month: 'long' }),
      done: true,
    },
    {
      label: 'Gabah ditimbang',
      meta: p.weighing
        ? `${formatDate(p.weighing.weighedAt)} · ${formatKg(s.weighing?.weighed ?? 0)}${p.weighing.receiptName ? ` · ${p.weighing.receiptName}` : ''}`
        : 'Menunggu di Penerimaan',
      done: Boolean(p.weighing),
    },
    {
      label: 'Berat dikonfirmasi',
      meta: p.weighing?.confirmedAt
        ? `${formatDate(p.weighing.confirmedAt)} · netto ${formatKg(s.weighing?.netto ?? 0)}`
        : 'Belum dikonfirmasi',
      done: isPurchaseReceivedForAp(p.stage),
    },
    {
      label: 'Pemasok dibayar lunas',
      meta:
        s.payment === 'lunas' && lastPayment
          ? `${formatDate(lastPayment.date)}${lastPayment.receiptName ? ` · ${lastPayment.receiptName}` : ''}`
          : isPurchaseReceivedForAp(p.stage)
            ? `Sisa ${formatRupiah(s.outstanding)}`
            : 'Setelah berat dikonfirmasi',
      done: s.payment === 'lunas',
    },
  ]
  const current = steps.findIndex((step) => !step.done)

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={p.id}
      subtitle={`${supplier?.name ?? '—'} · ${formatDate(p.date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`}
      badge={<StatusPill label={STAGE_LABEL[p.stage]} tone={STAGE_TONE[p.stage]} />}
      footer={
        <>
          <button
            type="button"
            onClick={onPrint}
            className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
          >
            Cetak bukti
          </button>
          <button
            type="button"
            onClick={() =>
              onGoTo(isPurchaseReceivedForAp(p.stage) ? 'pembayaran' : 'penerimaan')
            }
            className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
          >
            {isPurchaseReceivedForAp(p.stage)
              ? 'Lihat pembayaran →'
              : isPurchaseAwaitingWeigh(p.stage)
                ? 'Lanjut timbang →'
                : 'Konfirmasi berat →'}
          </button>
          {canHardDeletePurchase(p.stage) ? (
            <button
              type="button"
              onClick={onDelete}
              className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-red-700 transition hover:bg-red-50"
            >
              Batalkan catatan
            </button>
          ) : null}
        </>
      }
    >
      <DrawerHero
        label={isPurchaseReceivedForAp(p.stage) ? 'Nilai final' : 'Nilai taksiran'}
        amount={formatRupiah(
          isPurchaseReceivedForAp(p.stage) ? s.total : s.estimatedValue,
        )}
      />

      <div className="mb-4 rounded-2xl border border-line/80 bg-surface/80 px-3.5 py-3">
        <p className="text-[13px] font-medium text-ink">{supplier?.name}</p>
        <p className="mt-0.5 text-[12px] text-muted">{supplier?.village}</p>
      </div>

      <DrawerSection label="Rincian">
        <DrawerFacts
          items={[
            ['Jenis gabah', `${p.grain} · ${GRAIN_STANDARD[p.grain].label}`],
            ['Jumlah karung', `${p.sacks} karung`],
            ['Taksiran berat', formatKg(p.estimatedKg)],
            ['Harga sepakat', `${formatRupiah(p.price)}/kg`],
            p.vehicle ? ['Kendaraan', p.vehicle] : null,
            p.weighing?.receiptName ? ['Bukti timbang', p.weighing.receiptName] : null,
            p.note ? ['Catatan', p.note] : null,
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
