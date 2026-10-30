import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { DetailFields, FinanceModal } from '@/components/keuangan/FinanceModal'
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
import type { DualTrackResult } from '@/features/keuangan/dual-track-result'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { printBukti } from '@/components/keuangan/print-bukti'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { proofLabel, proofToReceipt, receiptToProof } from '@/components/pembelian/proof-ui'
import { PromptDialog } from '@/components/ui/ConfirmDialog'
import { EyeIcon } from '@/components/ui/icons'
import { useAuth } from '@/features/auth/AuthContext'
import { hasProof } from '@/features/workflow/proof'
import type { ProofAttachment } from '@/features/workflow/proof'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import {
  GRAIN_STANDARD,
  STAGE_LABEL,
  TARA_PER_SACK,
  VARIANCE_TOLERANCE,
  calcWeighing,
  formatDate,
  formatKg,
  formatNumber,
  formatPercent,
  formatRupiah,
  getLotQc,
  getSupplier,
  parseNumber,
  canVoidPurchase,
  isPurchaseAwaitingWeigh,
  isPurchaseReceivedForAp,
  summarize,
  type GrainType,
  type LotQc,
  type Purchase,
  type WeighingInput,
} from '@/features/pembelian/pembelian-data'
import { usePageSize } from '@/features/settings/usePageSize'

const FILTERS = [
  { value: 'konfirmasi' as const, label: 'Menunggu konfirmasi' },
  { value: 'antre' as const, label: 'Antre timbang' },
  { value: 'selesai' as const, label: 'Sudah dikonfirmasi' },
  { value: 'semua' as const, label: 'Semua status' },
]

const GRAIN_FILTERS = [
  { value: 'semua' as const, label: 'Semua jenis' },
  { value: 'GKP' as const, label: 'GKP' },
  { value: 'GKG' as const, label: 'GKG' },
]

type QueueFilter = (typeof FILTERS)[number]['value']
type GrainFilter = (typeof GRAIN_FILTERS)[number]['value']
type SortKey = 'id' | 'supplier' | 'grain' | 'date' | 'estimated' | 'stage'
type MeasureKey = 'bruto' | 'tara' | 'moisture' | 'impurity'
type FormState = Record<MeasureKey, string>
type FormErrors = Partial<Record<MeasureKey, string>>

function qcTone(qc: LotQc | undefined): 'neutral' | 'good' | 'warn' | 'danger' {
  if (!qc) return 'warn'
  if (qc.passed) return 'good'
  if (qc.overrideReason) return 'warn'
  return 'danger'
}

function qcLabel(qc: LotQc | undefined): string {
  if (!qc) return 'Belum QC'
  if (qc.passed) return 'QC lulus'
  if (qc.overrideReason) return 'QC override'
  return 'QC gagal'
}

type PenerimaanViewProps = {
  purchases: Purchase[]
  lotQc: LotQc[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSaveWeighing: (id: string, input: WeighingInput) => void
  onConfirm: (
    id: string,
    input: WeighingInput,
    purchaseProof?: ProofAttachment | string,
  ) => DualTrackResult
  onVoid?: (id: string, reason: string) => void
  onGoTo: (tab: 'pembayaran', id: string) => void
  onCompletePurchase: (id: string) => string | undefined
  onOverrideQc: (lotId: string, reason: string) => string | undefined
}

export function PenerimaanView({
  purchases,
  lotQc,
  selectedId,
  onSelect,
  onSaveWeighing,
  onConfirm,
  onVoid,
  onGoTo,
  onCompletePurchase,
  onOverrideQc,
}: PenerimaanViewProps) {
  const PAGE_SIZE = usePageSize()
  const waiting = useMemo(
    () => purchases.filter((p) => isPurchaseAwaitingWeigh(p.stage)),
    [purchases],
  )
  const weighed = useMemo(
    () => purchases.filter((p) => p.stage === 'ditimbang'),
    [purchases],
  )
  const confirmed = useMemo(
    () => purchases.filter((p) => isPurchaseReceivedForAp(p.stage)),
    [purchases],
  )

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<QueueFilter>(
    weighed.length > 0 ? 'konfirmasi' : waiting.length > 0 ? 'antre' : 'selesai',
  )
  const [grainFilter, setGrainFilter] = useState<GrainFilter>('semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [work, setWork] = useState<Purchase | null>(null)
  const [detail, setDetail] = useState<Purchase | null>(null)

  const stats: MetricCardData[] = [
    {
      label: 'Antre timbang',
      value: String(waiting.length),
      delta: waiting.length > 0 ? 'Belum ditimbang' : 'Kosong',
      positive: waiting.length === 0,
      spark: [2, 3, 2, 3, 2, 2, 3],
    },
    {
      label: 'Menunggu konfirmasi',
      value: String(weighed.length),
      delta: weighed.length > 0 ? 'Perlu setuju' : '0',
      positive: weighed.length === 0,
      spark: [1, 2, 1, 2, 2, 1, 2],
    },
    {
      label: 'Sudah dikonfirmasi',
      value: String(confirmed.length),
      delta: 'Siap bayar',
      positive: true,
      spark: [1, 1, 2, 2, 3, 3, 4],
    },
    {
      label: 'Total dokumen',
      value: String(purchases.length),
      delta: 'Semua tahap',
      positive: true,
      spark: [6, 7, 7, 8, 8, 9, 9],
    },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = purchases.filter((p) => {
      if (filter === 'antre' && !isPurchaseAwaitingWeigh(p.stage)) return false
      if (filter === 'konfirmasi' && p.stage !== 'ditimbang') return false
      if (filter === 'selesai' && !isPurchaseReceivedForAp(p.stage)) return false
      if (grainFilter !== 'semua' && p.grain !== (grainFilter as GrainType))
        return false
      if (dateFrom && p.date < dateFrom) return false
      if (dateTo && p.date > dateTo) return false
      if (!q) return true
      const s = getSupplier(p.supplierId)
      return [p.id, s?.name, p.grain, p.vehicle].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (p) => p.id,
      supplier: (p) => getSupplier(p.supplierId)?.name ?? '',
      grain: (p) => p.grain,
      date: (p) => p.weighing?.confirmedAt ?? p.weighing?.weighedAt ?? p.date,
      estimated: (p) => p.estimatedKg,
      stage: (p) => p.stage,
    })
  }, [purchases, search, filter, grainFilter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  useEffect(() => {
    if (!selectedId) return
    const found = purchases.find((p) => p.id === selectedId)
    if (!found) return
    if (isPurchaseAwaitingWeigh(found.stage) || found.stage === 'ditimbang') {
      openWork(found)
      return
    }
    if (found.stage === 'menunggu_selesai' || found.stage === 'selesai') {
      setDetail(found)
    }
  }, [selectedId, purchases])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function openWork(p: Purchase) {
    setWork(p)
    onSelect(p.id)
  }

  function closeWork() {
    setWork(null)
    onSelect(null)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Penerimaan & timbang</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Timbang gabah datang dan konfirmasi berat bersama pemasok
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
          searchPlaceholder="Cari dokumen, pemasok, nopol…"
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
        />

        <FinanceTable minWidth="820px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Dokumen" sortKey="id" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Pemasok"
              sortKey="supplier"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Gabah"
              sortKey="grain"
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
              label="Taksiran"
              sortKey="estimated"
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
            <FinanceTh>QC</FinanceTh>
            <FinanceTh align="center" className="w-32">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={9} message="Tidak ada dokumen yang cocok." />
            ) : (
              rows.map((p, index) => {
                const supplier = getSupplier(p.supplierId)
                const dateShow =
                  p.weighing?.confirmedAt ?? p.weighing?.weighedAt ?? p.date
                const qc =
                  p.lotId != null ? getLotQc(lotQc, p.lotId) : undefined
                return (
                  <FinanceTr key={p.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {p.id}
                      <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                        {p.sacks} karung
                      </span>
                    </FinanceTd>
                    <FinanceTd className="font-medium">{supplier?.name}</FinanceTd>
                    <FinanceTd mono muted>
                      {p.grain}
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {formatDate(dateShow)}
                    </FinanceTd>
                    <FinanceTd mono align="right">
                      {formatKg(p.estimatedKg)}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={STAGE_LABEL[p.stage]}
                        tone={
                          isPurchaseReceivedForAp(p.stage)
                            ? 'good'
                            : p.stage === 'ditimbang'
                              ? 'warn'
                              : 'neutral'
                        }
                      />
                    </FinanceTd>
                    <FinanceTd>
                      {p.lotId ? (
                        <StatusPill label={qcLabel(qc)} tone={qcTone(qc)} />
                      ) : (
                        <span className="text-[12px] text-muted">—</span>
                      )}
                    </FinanceTd>
                    <FinanceTd align="center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setDetail(p)}
                          className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                          aria-label={`Detail ${p.id}`}
                          title="Detail"
                        >
                          <EyeIcon className="size-[18px]" />
                        </button>
                        {p.stage === 'selesai' ? (
                          <button
                            type="button"
                            onClick={() => onGoTo('pembayaran', p.id)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            Bayar
                          </button>
                        ) : isPurchaseAwaitingWeigh(p.stage) || p.stage === 'ditimbang' ? (
                          <button
                            type="button"
                            onClick={() => openWork(p)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            {isPurchaseAwaitingWeigh(p.stage) ? 'Timbang' : 'Konfirmasi'}
                          </button>
                        ) : p.stage === 'menunggu_selesai' ? (
                          <button
                            type="button"
                            onClick={() => setDetail(p)}
                            className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                          >
                            Selesai
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
        <ReceiveDetailDrawer
          purchase={detail}
          onClose={() => setDetail(null)}
          onPrint={() => {
            if (!printReceive(detail)) setToast('Izinkan popup untuk mencetak')
          }}
          onVoid={onVoid}
          onComplete={() => {
            const err = onCompletePurchase(detail.id)
            if (err) {
              setToast(err)
              return
            }
            setToast(`${detail.id} dinyatakan selesai`)
            setDetail(null)
          }}
        />
      ) : null}

      {work ? (
        <WeighingModal
          key={work.id}
          purchase={work}
          lotQc={lotQc}
          onClose={closeWork}
          onSave={(input) => {
            onSaveWeighing(work.id, input)
            setToast(
              `${work.id} hasil timbang disimpan${
                input.receiptName ? ` · bukti ${input.receiptName}` : ''
              }`,
            )
          }}
          onConfirm={(input, purchaseProof) => {
            const result = onConfirm(work.id, input, purchaseProof)
            if (!result.ok) {
              setToast(result.error)
              return result.error
            }
            const base = `${work.id} berat dikonfirmasi${
              input.receiptName ? ` · bukti ${input.receiptName}` : ''
            }`
            if (result.journalError) {
              setToast(`${base} · jurnal gagal: ${result.journalError}`)
            } else {
              setToast(base)
            }
            closeWork()
            return undefined
          }}
          onOverrideQc={onOverrideQc}
        />
      ) : null}
    </div>
  )
}

function printReceive(p: Purchase) {
  const supplier = getSupplier(p.supplierId)
  const s = summarize(p)
  const std = GRAIN_STANDARD[p.grain]
  return printBukti(
    `Bukti penerimaan ${p.id}`,
    [
      {
        label: 'Nilai',
        value: formatRupiah(
          isPurchaseReceivedForAp(p.stage) ? s.total : s.estimatedValue,
        ),
      },
      { label: 'Pemasok', value: supplier?.name ?? '—' },
      { label: 'No. dokumen', value: p.id },
      { label: 'Tanggal', value: formatDate(p.date) },
      { label: 'Status', value: STAGE_LABEL[p.stage] },
      { label: 'Gabah', value: `${p.grain} · ${std.label}` },
      s.weighing
        ? { label: 'Netto', value: formatKg(s.weighing.netto) }
        : { label: 'Taksiran', value: formatKg(p.estimatedKg) },
    ],
    { subtitle: supplier?.name, module: 'Pembelian · Penerimaan' },
  )
}

function ReceiveDetailDrawer({
  purchase: p,
  onClose,
  onPrint,
  onVoid,
  onComplete,
}: {
  purchase: Purchase
  onClose: () => void
  onPrint: () => void
  onVoid?: (id: string, reason: string) => void
  onComplete?: () => void
}) {
  const { user } = useAuth()
  const canFinance = user?.role === 'keuangan' || user?.role === 'admin'
  const supplier = getSupplier(p.supplierId)
  const s = summarize(p)
  const std = GRAIN_STANDARD[p.grain]
  const [voidPromptOpen, setVoidPromptOpen] = useState(false)

  return (
    <>
    <DetailDrawer
      open
      onClose={onClose}
      title={p.id}
      subtitle={`${supplier?.name ?? '—'} · ${formatDate(p.date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}`}
      badge={
        <StatusPill
          label={p.voidedAt ? 'Void' : STAGE_LABEL[p.stage]}
          tone={
            p.voidedAt
              ? 'muted'
              : isPurchaseReceivedForAp(p.stage)
                ? 'good'
                : p.stage === 'ditimbang'
                  ? 'warn'
                  : 'neutral'
          }
        />
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
          {p.stage === 'menunggu_selesai' &&
          canFinance &&
          hasProof(p.purchaseProof) &&
          onComplete ? (
            <button
              type="button"
              onClick={onComplete}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Nyatakan selesai
            </button>
          ) : null}
          {canVoidPurchase(p.stage) && !p.voidedAt && onVoid ? (
            <button
              type="button"
              onClick={() => setVoidPromptOpen(true)}
              className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
            >
              Void (balik stok & utang)
            </button>
          ) : null}
          {p.lotId ? (
            <p className="text-center text-[11px] text-muted">Lot: {p.lotId}</p>
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
            ['Gabah', `${p.grain} · ${std.label}`],
            ['Karung', `${p.sacks} karung`],
            ['Taksiran', formatKg(p.estimatedKg)],
            s.weighing
              ? ['Netto', formatKg(s.weighing.netto)]
              : null,
            p.vehicle ? ['Kendaraan', p.vehicle] : null,
            p.weighing?.receiptName
              ? ['Bukti timbang', p.weighing.receiptName]
              : null,
            p.note ? ['Catatan', p.note] : null,
            proofLabel(p.purchaseProof)
              ? ['Struk beli', proofLabel(p.purchaseProof)!]
              : null,
          ]}
        />
      </DrawerSection>
    </DetailDrawer>

    <PromptDialog
      open={voidPromptOpen}
      title="Void penerimaan"
      description={`Penerimaan ${p.id} akan di-void. Stok dan utang terkait dibalik (MVP lokal).`}
      label="Alasan void"
      placeholder="Tulis alasan void penerimaan…"
      confirmLabel="Void"
      danger
      onClose={() => setVoidPromptOpen(false)}
      onConfirm={(reason) => {
        onVoid?.(p.id, reason)
        setVoidPromptOpen(false)
        onClose()
      }}
    />
    </>
  )
}

function WeighingModal({
  purchase: p,
  lotQc,
  onClose,
  onSave,
  onConfirm,
  onOverrideQc,
}: {
  purchase: Purchase
  lotQc: LotQc[]
  onClose: () => void
  onSave: (input: WeighingInput) => void
  onConfirm: (
    input: WeighingInput,
    purchaseProof?: ProofAttachment | string,
  ) => string | undefined
  onOverrideQc: (lotId: string, reason: string) => string | undefined
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const supplier = getSupplier(p.supplierId)
  const std = GRAIN_STANDARD[p.grain]
  const qc = p.lotId ? getLotQc(lotQc, p.lotId) : undefined
  const qcBlocked =
    p.stage === 'ditimbang' &&
    p.lotId != null &&
    (!qc || (!qc.passed && !qc.overrideReason))

  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideError, setOverrideError] = useState<string>()
  const [pendingConfirm, setPendingConfirm] = useState<{
    input: WeighingInput
    proof?: ProofAttachment | string
  } | null>(null)

  const [form, setForm] = useState<FormState>(() => ({
    bruto: p.weighing ? String(p.weighing.bruto) : '',
    tara: String(p.weighing?.tara ?? p.sacks * TARA_PER_SACK),
    moisture: p.weighing ? String(p.weighing.moisture).replace('.', ',') : '',
    impurity: p.weighing ? String(p.weighing.impurity).replace('.', ',') : '',
  }))
  const [errors, setErrors] = useState<FormErrors>({})
  const [agreed, setAgreed] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptValue>(null)
  const [receiptError, setReceiptError] = useState<string>()
  const [purchaseReceipt, setPurchaseReceipt] = useState<ReceiptValue>(() =>
    proofToReceipt(p.purchaseProof),
  )
  const [purchaseReceiptError, setPurchaseReceiptError] = useState<string>()

  const input: WeighingInput = {
    bruto: parseNumber(form.bruto),
    tara: parseNumber(form.tara),
    moisture: parseNumber(form.moisture),
    impurity: parseNumber(form.impurity),
    receiptName: receipt?.name ?? p.weighing?.receiptName,
  }
  const calc = calcWeighing(p.grain, input)
  const hasBruto = input.bruto > 0
  const variance = hasBruto ? calc.weighed - p.estimatedKg : 0
  const variancePct = p.estimatedKg > 0 ? (variance / p.estimatedKg) * 100 : 0
  const varianceWarn = hasBruto && Math.abs(variancePct) > VARIANCE_TOLERANCE

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(forConfirm: boolean): boolean {
    const next: FormErrors = {}
    if (input.bruto <= 0) next.bruto = 'Isi berat bruto'
    if (input.tara < 0) next.tara = 'Tidak boleh negatif'
    else if (input.bruto > 0 && input.tara >= input.bruto)
      next.tara = 'Harus lebih kecil dari bruto'
    if (input.moisture <= 0 || input.moisture > 40) next.moisture = 'Antara 0–40%'
    if (input.impurity < 0 || input.impurity > 30) next.impurity = 'Antara 0–30%'
    setErrors(next)

    const hasReceipt = Boolean(receipt || p.weighing?.receiptName)
    if (!hasReceipt) {
      setReceiptError('Lampirkan bukti timbang (foto/galeri)')
      return false
    }
    setReceiptError(undefined)

    if (forConfirm) {
      const hasPurchaseProof =
        Boolean(purchaseReceipt) || hasProof(p.purchaseProof)
      if (!hasPurchaseProof) {
        setPurchaseReceiptError('Lampirkan struk beli sebelum konfirmasi')
        return false
      }
      setPurchaseReceiptError(undefined)
    }

    return Object.keys(next).length === 0
  }

  function runConfirm(forConfirm: boolean) {
    if (!validate(forConfirm)) return
    const proof = receiptToProof(purchaseReceipt) ?? p.purchaseProof
    if (
      forConfirm &&
      qcBlocked &&
      isAdmin &&
      p.lotId &&
      qc &&
      !qc.passed &&
      !qc.overrideReason
    ) {
      setOverrideError(undefined)
      setPendingConfirm({ input, proof })
      setOverrideOpen(true)
      return
    }
    const err = onConfirm(input, proof)
    if (err) return
  }

  return (
    <>
    <FinanceModal
      title={p.id}
      subtitle="Penerimaan & timbang"
      wide
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {p.stage === 'ditimbang' ? (
            <Switch
              id="pn-agree"
              label="Pemasok menyetujui berat netto"
              checked={agreed}
              onChange={setAgreed}
            />
          ) : (
            <p className="text-[12px] text-muted">Simpan hasil timbang dulu, lalu konfirmasi.</p>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium text-ink transition hover:bg-surface"
            >
              Tutup
            </button>
            {isPurchaseAwaitingWeigh(p.stage) ? (
              <button
                type="button"
                onClick={() => {
                  if (validate(false)) onSave(input)
                }}
                className="h-11 rounded-xl bg-brand-800 px-4 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Simpan timbang
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (validate(false)) onSave(input)
                  }}
                  className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium text-ink transition hover:bg-surface"
                >
                  Perbarui
                </button>
                <button
                  type="button"
                  disabled={!agreed}
                  onClick={() => runConfirm(true)}
                  className="h-11 rounded-xl bg-brand-800 px-4 text-[14px] font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Konfirmasi berat
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <DetailFields
          fields={[
            { label: 'Pemasok', value: supplier?.name ?? '—' },
            {
              label: 'Gabah',
              value: `${p.grain} · ${std.label} · ${p.sacks} karung`,
            },
            { label: 'Taksiran', value: formatKg(p.estimatedKg) },
            { label: 'Harga', value: `${formatRupiah(p.price)}/kg` },
            p.lotId ? { label: 'Lot', value: p.lotId } : null,
          ].filter(Boolean) as { label: string; value: string }[]}
        />

        {p.lotId ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/70 px-3.5 py-2.5">
            <div>
              <p className="text-[12px] font-medium text-ink">QC lot</p>
              <p className="mt-0.5 text-[11px] text-muted">
                Konfirmasi butuh QC lulus atau override admin.
              </p>
            </div>
            <StatusPill label={qcLabel(qc)} tone={qcTone(qc)} />
          </div>
        ) : null}

        {qcBlocked && !qc ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            Isi QC di menu QC Lot sebelum konfirmasi penerimaan.
          </p>
        ) : null}

        {qcBlocked && qc && !qc.passed && !qc.overrideReason && isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setOverrideError(undefined)
              setOverrideOpen(true)
            }}
            className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-900 transition hover:bg-amber-100"
          >
            Override QC (admin)
          </button>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="pn-bruto"
            label="Berat bruto (kg)"
            requiredMark
            inputMode="decimal"
            value={form.bruto}
            onChange={(e) => set('bruto', e.target.value)}
            error={errors.bruto}
          />
          <TextField
            id="pn-tara"
            label="Tara karung (kg)"
            inputMode="decimal"
            value={form.tara}
            onChange={(e) => set('tara', e.target.value)}
            error={errors.tara}
          />
          <TextField
            id="pn-moisture"
            label="Kadar air (%)"
            requiredMark
            inputMode="decimal"
            value={form.moisture}
            onChange={(e) => set('moisture', e.target.value)}
            error={errors.moisture}
          />
          <TextField
            id="pn-impurity"
            label="Hampa/kotoran (%)"
            requiredMark
            inputMode="decimal"
            value={form.impurity}
            onChange={(e) => set('impurity', e.target.value)}
            error={errors.impurity}
          />
        </div>

        <div className="rounded-xl border border-line bg-surface/70 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-muted">Berat netto</span>
            <span className="num text-[18px] font-semibold text-ink">
              {formatNumber(calc.netto)} kg
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 text-[13px]">
            <span className="text-muted">Nilai pembelian</span>
            <span className="num font-semibold text-brand-800">
              {formatRupiah(calc.netto * p.price)}
            </span>
          </div>
          {hasBruto ? (
            <p
              className={[
                'mt-2 rounded-lg px-2.5 py-1.5 font-mono text-[11px]',
                varianceWarn ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800',
              ].join(' ')}
            >
              Selisih vs taksiran: {variance >= 0 ? '+' : '−'}
              {formatKg(Math.abs(variance))} ({formatPercent(Math.abs(variancePct))})
              {varianceWarn ? ` · di atas toleransi ${VARIANCE_TOLERANCE}%` : ' · wajar'}
            </p>
          ) : null}
        </div>

        <ReceiptUpload
          value={receipt}
          onChange={(v) => {
            setReceipt(v)
            setReceiptError(undefined)
          }}
          label="Bukti timbang / foto karung"
          requiredMark
          error={receiptError}
          hint={
            p.weighing?.receiptName && !receipt
              ? `Sudah ada: ${p.weighing.receiptName} — unggah ulang untuk mengganti`
              : undefined
          }
        />

        {p.stage === 'ditimbang' ? (
          <ReceiptUpload
            value={purchaseReceipt}
            onChange={(v) => {
              setPurchaseReceipt(v)
              setPurchaseReceiptError(undefined)
            }}
            label="Struk beli"
            requiredMark
            error={purchaseReceiptError}
            hint="Wajib sebelum konfirmasi penerimaan · struk final dari pemasok"
          />
        ) : null}
      </div>
    </FinanceModal>

    <PromptDialog
      open={overrideOpen}
      title="Override QC lot"
      description={
        p.lotId
          ? `Lot ${p.lotId} tidak lulus QC. Admin dapat menerima dengan alasan tercatat di audit.`
          : undefined
      }
      label="Alasan override"
      placeholder="Misalnya mutu diterima setelah sortir ulang…"
      confirmLabel="Override & lanjut"
      danger
      submitError={overrideError}
      onClose={() => {
        setOverrideOpen(false)
        setOverrideError(undefined)
        setPendingConfirm(null)
      }}
      onConfirm={(reason) => {
        if (!p.lotId) return
        setOverrideError(undefined)
        const err = onOverrideQc(p.lotId, reason)
        if (err) {
          setOverrideError(err)
          return
        }
        setOverrideOpen(false)
        const pending = pendingConfirm
        setPendingConfirm(null)
        if (pending) {
          onConfirm(pending.input, pending.proof)
        } else if (validate(true)) {
          const proof = receiptToProof(purchaseReceipt) ?? p.purchaseProof
          onConfirm(input, proof)
        }
      }}
    />
    </>
  )
}
