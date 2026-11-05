import { useEffect, useMemo, useRef, useState } from 'react'
import { useDokParam } from '@/hooks/useDokParam'
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
import { FinanceModal, ModalActions } from '@/components/keuangan/FinanceModal'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { TaxPostFields } from '@/components/keuangan/TaxPostFields'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { PromptDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'
import { useTaxStore } from '@/features/keuangan/tax-store'
import { usePenjualan } from '@/features/penjualan/PenjualanContext'
import {
  formatDate,
  formatQty,
  getCustomer,
  nextSaleReturnId,
  parseNumber,
  resolveSaleTaxDefaults,
  returnedQtyForOrder,
  type SaleOrder,
  type SaleReturn,
  type SaleReturnLine,
} from '@/features/penjualan/penjualan-data'
import { usePageSize } from '@/features/settings/usePageSize'
import {
  RETURN_STAGE_LABEL,
  type ReturnStage,
} from '@/features/workflow/doc-stages'

const FILTERS = [
  { value: 'semua' as const, label: 'Semua tahap' },
  { value: 'draft' as const, label: 'Draft' },
  { value: 'diajukan' as const, label: 'Diajukan' },
  { value: 'disetujui' as const, label: 'Disetujui' },
  { value: 'posted' as const, label: 'Posted' },
  { value: 'ditolak' as const, label: 'Ditolak' },
]

type StageFilter = (typeof FILTERS)[number]['value']
type SortKey = 'id' | 'order' | 'qty' | 'date' | 'stage'

function shippedQty(order: SaleOrder): number {
  if (order.voidedAt || order.stage !== 'dikirim') return 0
  return order.qty
}

function remainingForOrder(returns: SaleReturn[], order: SaleOrder): number {
  return Math.max(
    0,
    shippedQty(order) - returnedQtyForOrder(returns, order.id, order.sku),
  )
}

function lineQty(row: SaleReturn): number {
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
  const { settings } = useTaxStore()
  const {
    orders,
    returns,
    createSaleReturn,
    submitSaleReturn,
    approveSaleReturn,
    rejectSaleReturn,
    postSaleReturn,
  } = usePenjualan()
  const canRecord = user?.role === 'admin' || user?.role === 'penjualan'
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
  const { dokId: drawerId, openDok, clearDok } = useDokParam()
  const [toast, setToast] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [ppnRate, setPpnRate] = useState<PpnRate>(
    () => resolveSaleTaxDefaults(settings).ppnRate,
  )
  const [priceMode, setPriceMode] = useState<PriceMode>(
    () => resolveSaleTaxDefaults(settings).priceMode,
  )
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
      delta: counts.draft ? 'Belum diajukan' : 'Kosong',
      positive: true,
    },
    {
      label: 'Diajukan',
      value: String(counts.diajukan),
      delta: counts.diajukan ? 'Menunggu keuangan' : 'Tidak ada antrian',
      positive: counts.diajukan === 0,
    },
    {
      label: 'Disetujui',
      value: String(counts.disetujui),
      delta: counts.disetujui ? 'Siap posting' : ',',
      positive: true,
    },
    {
      label: 'Posted',
      value: String(counts.posted),
      delta: counts.posted ? 'Stok & piutang' : ',',
      positive: true,
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
      const order = orders.find((o) => o.id === row.orderId)
      const customer = order ? getCustomer(order.customerId)?.name : ''
      return [row.id, row.orderId, row.reason, customer].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (row) => row.id,
      order: (row) => row.orderId,
      qty: (row) => lineQty(row),
      date: (row) => row.createdAt,
      stage: (row) => row.stage,
    })
  }, [returns, orders, search, filter, dateFrom, dateTo, sort])

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
    if (drawerId) setCreating(false)
  }, [drawerId])

  useEffect(() => {
    const id = pendingSubmitId.current
    if (!id) return
    const row = returns.find((item) => item.id === id && item.stage === 'draft')
    if (!row) return
    pendingSubmitId.current = null
    const err = submitSaleReturn(id)
    setToast(err ?? `${id} diajukan`)
  }, [returns, submitSaleReturn])

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openPost(row: SaleReturn) {
    const tax = resolveSaleTaxDefaults(settings)
    setPpnRate(row.ppnRate === 0 || row.ppnRate === 11 ? row.ppnRate : tax.ppnRate)
    setPriceMode(
      row.priceMode === 'inclusive' || row.priceMode === 'exclusive'
        ? row.priceMode
        : tax.priceMode,
    )
    setPostOpen(true)
  }

  const postSubtotal = useMemo(() => {
    if (!active) return 0
    const order = orders.find((o) => o.id === active.orderId)
    if (!order) return 0
    return active.lines.reduce((sum, line) => {
      if (line.sku !== order.sku) return sum
      return sum + line.qty * order.price
    }, 0)
  }, [active, orders])

  function closeDrawer() {
    setCreating(false)
    clearDok()
    setPostOpen(false)
    setRejectOpen(false)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Retur penjualan</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Kembalikan barang dari pelanggan. Posting menambah stok dan menyesuaikan piutang.
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
          searchPlaceholder="Cari retur, order, pelanggan, alasan…"
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
                  clearDok()
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
              label="Order"
              sortKey="order"
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
                const order = orders.find((o) => o.id === row.orderId)
                const customer = order ? getCustomer(order.customerId) : undefined
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {row.id}
                    </FinanceTd>
                    <FinanceTd>
                      <span className="font-medium">{row.orderId}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {customer?.name ?? ','}
                      </span>
                    </FinanceTd>
                    <FinanceTd mono align="right">
                      {formatQty(lineQty(row), row.lines[0]?.unit ?? 'kg')}
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
                          openDok(row.id)
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
          orders={orders}
          returns={returns}
          canRecord={canRecord}
          canFinance={canFinance}
          onClose={closeDrawer}
          onSave={(input, andSubmit) => {
            const predicted = input.id ?? nextSaleReturnId(returns)
            const existing = input.id
              ? returns.find((row) => row.id === input.id)
              : undefined
            const tax = resolveSaleTaxDefaults(settings)
            const err = createSaleReturn({
              ...input,
              ppnRate:
                existing?.ppnRate === 0 || existing?.ppnRate === 11
                  ? existing.ppnRate
                  : tax.ppnRate,
              priceMode:
                existing?.priceMode === 'inclusive' ||
                existing?.priceMode === 'exclusive'
                  ? existing.priceMode
                  : tax.priceMode,
            })
            if (err) return err
            setCreating(false)
            openDok(predicted)
            if (andSubmit) pendingSubmitId.current = predicted
            else setToast(`${predicted} disimpan sebagai draft`)
            return undefined
          }}
          onApprove={(id) => {
            const err = approveSaleReturn(id)
            setToast(err ?? `${id} disetujui`)
          }}
          onAskReject={() => setRejectOpen(true)}
          onAskPost={() => {
            if (active) openPost(active)
          }}
        />
      ) : null}

      {postOpen && active ? (
        <FinanceModal
          title="Posting retur"
          subtitle="Konfirmasi"
          onClose={() => setPostOpen(false)}
          footer={
            <ModalActions
              onCancel={() => setPostOpen(false)}
              onConfirm={() => {
                const result = postSaleReturn(active.id, { ppnRate, priceMode })
                setPostOpen(false)
                if (!result.ok) {
                  setToast(result.error)
                  return
                }
                if (result.journalError) {
                  setToast(`Diposting, tetapi jurnal gagal: ${result.journalError}`)
                } else {
                  setToast(`${active.id} diposting`)
                }
              }}
              confirmLabel="Posting"
            />
          }
        >
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-muted">
              Retur {active.id} menambah stok dan menyesuaikan piutang order{' '}
              {active.orderId}.
            </p>
            <TaxPostFields
              subtotal={postSubtotal}
              rate={ppnRate}
              priceMode={priceMode}
              onRateChange={setPpnRate}
              onModeChange={setPriceMode}
            />
          </div>
        </FinanceModal>
      ) : null}

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
          const err = rejectSaleReturn(active.id, reason)
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
  orders,
  returns,
  canRecord,
  canFinance,
  onClose,
  onSave,
  onApprove,
  onAskReject,
  onAskPost,
}: {
  row: SaleReturn | null
  waiting: boolean
  orders: SaleOrder[]
  returns: SaleReturn[]
  canRecord: boolean
  canFinance: boolean
  onClose: () => void
  onSave: (
    input: {
      id?: string
      orderId: string
      lines: SaleReturnLine[]
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
  const eligible = orders.filter((o) => o.stage === 'dikirim' && !o.voidedAt)

  const [orderId, setOrderId] = useState(row?.orderId ?? '')
  const [qty, setQty] = useState(() => {
    const first = row?.lines[0]
    return first ? String(first.qty).replace('.', ',') : ''
  })
  const [reason, setReason] = useState(row?.reason ?? '')
  const [error, setError] = useState<string | undefined>()

  const order = orders.find((o) => o.id === orderId)
  const remaining = order ? remainingForOrder(returns, order) : 0

  function buildInput() {
    if (!order) return 'Pilih order yang sudah dikirim.'
    const amount = parseNumber(qty)
    if (amount <= 0) return 'Qty retur harus lebih dari 0.'
    if (amount > remaining) {
      return `Qty melebihi sisa dikirim (${formatQty(remaining, order.unit)}).`
    }
    if (!reason.trim()) return 'Alasan retur wajib diisi.'
    return {
      id: row?.id,
      orderId: order.id,
      lines: [
        {
          sku: order.sku,
          productName: order.productName,
          unit: order.unit,
          qty: amount,
        },
      ],
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
          ? row.orderId
          : 'Draft retur dari order yang sudah dikirim'
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
            id="retur-order"
            label="Order"
            requiredMark
            value={orderId}
            placeholder="Pilih order dikirim"
            options={eligible.map((o) => {
              const customer = getCustomer(o.customerId)
              const sisa = remainingForOrder(returns, o)
              return {
                value: o.id,
                label: o.id,
                description: `${customer?.name ?? ','} · ${o.productName} · sisa ${formatQty(sisa, o.unit)}`,
              }
            })}
            onChange={(id) => {
              setOrderId(id)
              setQty('')
              setError(undefined)
            }}
          />
          <TextField
            id="retur-qty"
            label={`Qty retur (${order?.unit ?? 'kg'})`}
            requiredMark
            inputMode="decimal"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value)
              setError(undefined)
            }}
          />
          {order ? (
            <div className="space-y-1">
              <p className="text-[12px] text-muted">
                {order.productName} · {order.sku} · sisa {formatQty(remaining, order.unit)}
              </p>
              {order.lotId ? (
                <p className="text-[12px] text-muted">
                  Lot costing SO: <span className="font-medium text-ink">{order.lotId}</span>
                </p>
              ) : (
                <p className="text-[12px] text-amber-800">
                  Order belum punya lot costing — posting retur COGS akan ditolak.
                </p>
              )}
            </div>
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
              placeholder="Misalnya kualitas tidak sesuai pesanan"
              className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/55 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
          {eligible.length === 0 ? (
            <p className="text-[12px] text-muted">
              Belum ada order dikirim yang bisa diretur.
            </p>
          ) : null}
        </div>
      ) : row ? (
        <div className="space-y-4">
          <DrawerSection label="Dokumen">
            <DrawerFacts
              items={[
                ['Order', row.orderId],
                (() => {
                  const linked = orders.find((o) => o.id === row.orderId)
                  return linked?.lotId ? ['Lot costing SO', linked.lotId] : null
                })(),
                ['Qty', formatQty(lineQty(row), row.lines[0]?.unit ?? 'kg')],
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
                    {line.sku} · {formatQty(line.qty, line.unit)}
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
