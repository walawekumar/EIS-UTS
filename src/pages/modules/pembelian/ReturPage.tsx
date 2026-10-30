import { useEffect, useMemo, useRef, useState } from 'react'
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
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { ConfirmDialog, PromptDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import {
  calcWeighing,
  formatDate,
  formatKg,
  getSupplier,
  isPurchaseReceivedForAp,
  nextPurchaseReturnId,
  parseNumber,
  returnedQtyForPurchase,
  type Purchase,
  type PurchaseReturn,
  type PurchaseReturnLine,
} from '@/features/pembelian/pembelian-data'
import { usePageSize } from '@/features/settings/usePageSize'
import {
  RETURN_STAGE_LABEL,
  type ReturnStage,
} from '@/features/workflow/doc-stages'

/** Selaras dengan SKU terima di PembelianContext (GRAIN_SKU). */
const GRAIN_LINE: Record<string, Omit<PurchaseReturnLine, 'qty'>> = {
  GKP: { sku: 'GBH-IR64', productName: 'Gabah IR64 (GKP)', unit: 'kg' },
  GKG: { sku: 'GBH-CIHERANG', productName: 'Gabah Ciherang (GKG)', unit: 'kg' },
}

const FILTERS = [
  { value: 'semua' as const, label: 'Semua tahap' },
  { value: 'draft' as const, label: 'Draft' },
  { value: 'diajukan' as const, label: 'Diajukan' },
  { value: 'disetujui' as const, label: 'Disetujui' },
  { value: 'posted' as const, label: 'Posted' },
  { value: 'ditolak' as const, label: 'Ditolak' },
]

type StageFilter = (typeof FILTERS)[number]['value']
type SortKey = 'id' | 'purchase' | 'qty' | 'date' | 'stage'

function grainLine(grain: string): Omit<PurchaseReturnLine, 'qty'> {
  return GRAIN_LINE[grain] ?? GRAIN_LINE.GKP
}

function receivedKg(purchase: Purchase): number {
  if (!purchase.weighing || !isPurchaseReceivedForAp(purchase.stage)) return 0
  return calcWeighing(purchase.grain, purchase.weighing).netto
}

function lineQty(row: PurchaseReturn): number {
  return row.lines.reduce((sum, line) => sum + line.qty, 0)
}

function stageTone(stage: ReturnStage): 'neutral' | 'good' | 'warn' | 'danger' {
  if (stage === 'posted' || stage === 'disetujui') return 'good'
  if (stage === 'diajukan') return 'warn'
  if (stage === 'ditolak') return 'danger'
  return 'neutral'
}

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

export function ReturPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const {
    purchases,
    returns,
    createPurchaseReturn,
    submitPurchaseReturn,
    approvePurchaseReturn,
    rejectPurchaseReturn,
    postPurchaseReturn,
  } = usePembelian()
  const canRecord = user?.role === 'admin' || user?.role === 'pembelian'
  const canFinance = user?.role === 'admin' || user?.role === 'keuangan'

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
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const pendingSubmitId = useRef<string | null>(null)

  const counts = useMemo(() => {
    const tally = { draft: 0, diajukan: 0, disetujui: 0, posted: 0, ditolak: 0 }
    for (const row of returns) tally[row.stage] += 1
    return tally
  }, [returns])

  const stats: MetricCardData[] = [
    {
      label: 'Draft',
      value: String(counts.draft),
      delta: 'Belum diajukan',
      positive: true,
      spark: [1, 1, 2, 1, 2, 2, 1],
    },
    {
      label: 'Diajukan',
      value: String(counts.diajukan),
      delta: 'Menunggu keuangan',
      positive: counts.diajukan === 0,
      spark: [1, 2, 1, 2, 2, 1, 2],
    },
    {
      label: 'Disetujui',
      value: String(counts.disetujui),
      delta: 'Siap posting',
      positive: true,
      spark: [1, 1, 2, 2, 2, 3, 3],
    },
    {
      label: 'Posted',
      value: String(counts.posted),
      delta: 'Stok & utang',
      positive: true,
      spark: [1, 2, 2, 3, 3, 4, 4],
    },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = returns.filter((row) => {
      if (filter !== 'semua' && row.stage !== filter) return false
      const day = dateKey(row.createdAt)
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      if (!q) return true
      const purchase = purchases.find((p) => p.id === row.purchaseId)
      const supplier = purchase ? getSupplier(purchase.supplierId)?.name : ''
      return [row.id, row.purchaseId, row.lotId, row.reason, supplier].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (row) => row.id,
      purchase: (row) => row.purchaseId,
      qty: (row) => lineQty(row),
      date: (row) => row.createdAt,
      stage: (row) => row.stage,
    })
  }, [returns, purchases, search, filter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const active =
    drawerId != null ? (returns.find((row) => row.id === drawerId) ?? null) : null
  const drawerOpen = creating || drawerId != null

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const id = pendingSubmitId.current
    if (!id) return
    const row = returns.find((item) => item.id === id && item.stage === 'draft')
    if (!row) return
    pendingSubmitId.current = null
    const err = submitPurchaseReturn(id)
    setToast(err ?? `${id} diajukan`)
  }, [returns, submitPurchaseReturn])

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function closeDrawer() {
    setCreating(false)
    setDrawerId(null)
    setPostOpen(false)
    setRejectOpen(false)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Retur pembelian</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Kembalikan gabah ke pemasok. Posting memotong stok dan utang.
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
          searchPlaceholder="Cari retur, pembelian, lot, alasan…"
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
          actionLabel={canRecord ? 'Retur baru' : undefined}
          onAction={
            canRecord
              ? () => {
                  setDrawerId(null)
                  setCreating(true)
                }
              : undefined
          }
        />

        <FinanceTable minWidth="860px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Retur" sortKey="id" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Pembelian"
              sortKey="purchase"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh label="Qty" sortKey="qty" sort={sort} onSort={handleSort} align="right" />
            <FinanceSortTh label="Tanggal" sortKey="date" sort={sort} onSort={handleSort} />
            <FinanceSortTh label="Status" sortKey="stage" sort={sort} onSort={handleSort} />
            <FinanceTh align="center" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={7} message="Belum ada retur yang cocok." />
            ) : (
              rows.map((row, index) => {
                const purchase = purchases.find((p) => p.id === row.purchaseId)
                const supplier = purchase ? getSupplier(purchase.supplierId) : undefined
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {row.id}
                      {row.lotId ? (
                        <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                          {row.lotId}
                        </span>
                      ) : null}
                    </FinanceTd>
                    <FinanceTd>
                      <span className="font-medium">{row.purchaseId}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {supplier?.name ?? '—'}
                      </span>
                    </FinanceTd>
                    <FinanceTd mono align="right">
                      {formatKg(lineQty(row))}
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {formatDate(dateKey(row.createdAt))}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill label={RETURN_STAGE_LABEL[row.stage]} tone={stageTone(row.stage)} />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <button
                        type="button"
                        onClick={() => {
                          setCreating(false)
                          setDrawerId(row.id)
                        }}
                        className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                      >
                        {row.stage === 'draft' || row.stage === 'ditolak' ? 'Ubah' : 'Detail'}
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

      {drawerOpen ? (
        <ReturnDrawer
          key={creating ? 'new' : `${drawerId}-${active?.stage ?? 'wait'}`}
          row={creating ? null : active}
          waiting={!creating && drawerId != null && !active}
          purchases={purchases}
          returns={returns}
          canRecord={canRecord}
          canFinance={canFinance}
          onClose={closeDrawer}
          onSave={(input, andSubmit) => {
            const predicted = input.id ?? nextPurchaseReturnId(returns)
            const err = createPurchaseReturn(input)
            if (err) return err
            setCreating(false)
            setDrawerId(predicted)
            if (andSubmit) pendingSubmitId.current = predicted
            else setToast(`${predicted} disimpan sebagai draft`)
            return undefined
          }}
          onApprove={(id) => {
            const err = approvePurchaseReturn(id)
            setToast(err ?? `${id} disetujui`)
          }}
          onAskReject={() => setRejectOpen(true)}
          onAskPost={() => setPostOpen(true)}
        />
      ) : null}

      <ConfirmDialog
        open={postOpen && active != null}
        title="Posting retur"
        description={
          active
            ? `Retur ${active.id} mengurangi stok dan utang pembelian ${active.purchaseId}.`
            : undefined
        }
        confirmLabel="Posting"
        onClose={() => setPostOpen(false)}
        onConfirm={() => {
          if (!active) return
          const result = postPurchaseReturn(active.id)
          setPostOpen(false)
          if (!result.ok) {
            setToast(result.error)
          } else if (result.journalError) {
            setToast(
              `${active.id} diposting · jurnal gagal: ${result.journalError}`,
            )
          } else {
            setToast(`${active.id} diposting`)
          }
        }}
      />

      <PromptDialog
        open={rejectOpen && active != null}
        title="Tolak retur"
        description={
          active
            ? `Retur ${active.id} ditolak dan dapat diedit lalu diajukan ulang.`
            : undefined
        }
        label="Alasan penolakan"
        placeholder="Tulis alasan penolakan…"
        confirmLabel="Tolak"
        danger
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          if (!active) return
          const err = rejectPurchaseReturn(active.id, reason)
          setRejectOpen(false)
          setToast(err ?? `${active.id} ditolak`)
        }}
      />
    </div>
  )
}

function ReturnDrawer({
  row,
  waiting,
  purchases,
  returns,
  canRecord,
  canFinance,
  onClose,
  onSave,
  onApprove,
  onAskReject,
  onAskPost,
}: {
  row: PurchaseReturn | null
  waiting: boolean
  purchases: Purchase[]
  returns: PurchaseReturn[]
  canRecord: boolean
  canFinance: boolean
  onClose: () => void
  onSave: (
    input: {
      id?: string
      purchaseId: string
      lines: PurchaseReturnLine[]
      reason: string
    },
    andSubmit: boolean,
  ) => string | undefined
  onApprove: (id: string) => void
  onAskReject: () => void
  onAskPost: () => void
}) {
  const editable =
    canRecord && (row == null || row.stage === 'draft' || row.stage === 'ditolak')
  const eligible = purchases.filter(
    (p) => isPurchaseReceivedForAp(p.stage) && !p.voidedAt,
  )
  const [purchaseId, setPurchaseId] = useState(row?.purchaseId ?? '')
  const [qty, setQty] = useState(() => {
    const first = row?.lines[0]
    return first ? String(first.qty).replace('.', ',') : ''
  })
  const [reason, setReason] = useState(row?.reason ?? '')
  const [error, setError] = useState<string | undefined>()

  const purchase = purchases.find((p) => p.id === purchaseId)
  const skuLine = purchase ? grainLine(purchase.grain) : null
  const remaining =
    purchase && skuLine
      ? receivedKg(purchase) -
        returnedQtyForPurchase(returns, purchase.id, skuLine.sku)
      : 0

  function buildInput() {
    if (!purchase || !skuLine) return 'Pilih pembelian yang sudah diterima.'
    const amount = parseNumber(qty)
    if (amount <= 0) return 'Qty retur harus lebih dari 0.'
    if (amount > Math.max(0, remaining)) {
      return `Qty melebihi sisa diterima (${formatKg(Math.max(0, remaining))}).`
    }
    if (!reason.trim()) return 'Alasan retur wajib diisi.'
    return {
      id: row?.id,
      purchaseId: purchase.id,
      lines: [{ ...skuLine, qty: amount }],
      reason: reason.trim(),
    }
  }

  function save(andSubmit: boolean) {
    const built = buildInput()
    if (typeof built === 'string') {
      setError(built)
      return
    }
    const err = onSave(built, andSubmit)
    if (err) setError(err)
  }

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={row?.id ?? 'Retur baru'}
      subtitle={
        row
          ? `${row.purchaseId}${row.lotId ? ` · ${row.lotId}` : ''}`
          : 'Draft retur dari pembelian yang sudah diterima'
      }
      badge={
        row ? (
          <StatusPill label={RETURN_STAGE_LABEL[row.stage]} tone={stageTone(row.stage)} />
        ) : undefined
      }
      footer={
        <>
          {editable ? (
            <button
              type="button"
              onClick={() => save(false)}
              className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
            >
              Simpan draft
            </button>
          ) : null}
          {canRecord && (row == null || row.stage === 'draft' || row.stage === 'ditolak') ? (
            <button
              type="button"
              onClick={() => save(true)}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Ajukan
            </button>
          ) : null}
          {canFinance && row?.stage === 'diajukan' ? (
            <>
              <button
                type="button"
                onClick={() => onApprove(row.id)}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Setujui
              </button>
              <button
                type="button"
                onClick={onAskReject}
                className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
              >
                Tolak
              </button>
            </>
          ) : null}
          {canFinance && row?.stage === 'disetujui' ? (
            <button
              type="button"
              onClick={onAskPost}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Posting
            </button>
          ) : null}
        </>
      }
    >
      {waiting ? (
        <p className="text-[13px] text-muted">Menyimpan retur…</p>
      ) : editable ? (
        <div className="space-y-3">
          {row?.rejectedReason ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-800">
              Ditolak: {row.rejectedReason}
            </p>
          ) : null}
          <Select
            id="retur-purchase"
            label="Pembelian"
            requiredMark
            value={purchaseId}
            placeholder="Pilih pembelian diterima"
            options={eligible.map((p) => ({
              value: p.id,
              label: p.id,
              description: `${getSupplier(p.supplierId)?.name ?? '—'} · sisa ${formatKg(
                Math.max(
                  0,
                  receivedKg(p) -
                    returnedQtyForPurchase(returns, p.id, grainLine(p.grain).sku),
                ),
              )}`,
            }))}
            onChange={(id) => {
              setPurchaseId(id)
              setQty('')
              setError(undefined)
            }}
          />
          <TextField
            id="retur-qty"
            label="Qty retur (kg)"
            requiredMark
            inputMode="decimal"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value)
              setError(undefined)
            }}
          />
          {purchase ? (
            <p className="text-[12px] text-muted">
              {skuLine?.productName ?? purchase.grain} · sisa{' '}
              {formatKg(Math.max(0, remaining))}
            </p>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">
              Alasan
              <span className="ml-0.5 text-brand-600">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError(undefined)
              }}
              rows={3}
              placeholder="Misalnya kadar air di atas kesepakatan"
              className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/55 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
          {eligible.length === 0 ? (
            <p className="text-[12px] text-muted">
              Belum ada pembelian diterima yang bisa diretur.
            </p>
          ) : null}
        </div>
      ) : row ? (
        <div className="space-y-4">
          <DrawerSection label="Dokumen">
            <DrawerFacts
              items={[
                ['Pembelian', row.purchaseId],
                row.lotId ? ['Lot', row.lotId] : null,
                ['Qty', formatKg(lineQty(row))],
                ['Alasan', row.reason],
                row.rejectedReason ? ['Ditolak', row.rejectedReason] : null,
                row.postedAt ? ['Diposting', formatDate(dateKey(row.postedAt))] : null,
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Baris">
            <ul className="space-y-2">
              {row.lines.map((line) => (
                <li
                  key={`${line.sku}-${line.qty}`}
                  className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5 text-[13px]"
                >
                  <p className="font-medium text-ink">{line.productName}</p>
                  <p className="num mt-0.5 text-[12px] text-muted">
                    {line.sku} · {formatKg(line.qty)}
                  </p>
                </li>
              ))}
            </ul>
          </DrawerSection>
        </div>
      ) : null}
    </DetailDrawer>
  )
}
