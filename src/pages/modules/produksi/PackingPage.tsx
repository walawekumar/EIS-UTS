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
import {
  OpsPage,
  OpsPanel,
  OpsPanelHeader,
} from '@/components/ops/OpsChrome'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import {
  formatKg,
  parseNumber,
} from '@/features/pembelian/pembelian-data'
import {
  useProduksi,
} from '@/features/produksi/ProduksiContext'
import {
  formatDate,
  nextPackRunId,
  PRODUKSI_LOCATIONS,
  sumPackRunOutQty,
  type BatchLine,
  type PackRun,
  type PackRunLine,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'
import { stockKey } from '@/features/persediaan/persediaan-data'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { usePageSize } from '@/features/settings/usePageSize'

const FILTERS = [
  { value: 'semua' as const, label: 'Semua tahap' },
  { value: 'draft' as const, label: 'Draft' },
  { value: 'posted' as const, label: 'Posted' },
  { value: 'void' as const, label: 'Void' },
]

type StageFilter = (typeof FILTERS)[number]['value']
type SortKey = 'id' | 'batch' | 'qty' | 'date' | 'stage'

function packStageLabel(run: PackRun): string {
  if (run.voidedAt) return 'Void'
  return run.stage === 'posted' ? 'Posted' : 'Draft'
}

function packStageTone(run: PackRun): 'neutral' | 'good' | 'warn' | 'danger' {
  if (run.voidedAt) return 'danger'
  if (run.stage === 'posted') return 'good'
  return 'neutral'
}

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

function suggestPackLines(source: BatchLine, batch: ProductionBatch): PackRunLine[] {
  const loc = batch.toLocation
  const grades = ['A', 'B', 'C'] as const
  return grades.map((grade) => ({
    sku: `${source.sku}-${grade}`,
    productName: `${source.productName} Grade ${grade}`,
    unit: source.unit,
    grade,
    qty: 0,
    location: loc,
  }))
}

function parseLinesFromForm(
  lines: PackRunLine[],
  qtyStrings: string[],
): PackRunLine[] | string {
  const next: PackRunLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const qty = parseNumber(qtyStrings[i] ?? '0')
    if (qty < 0) return 'Qty tidak boleh negatif.'
    next.push({ ...lines[i], qty })
  }
  if (!next.some((l) => l.qty > 0)) return 'Minimal satu baris qty > 0.'
  return next.filter((l) => l.qty > 0)
}

export function PackingPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const {
    batches,
    packRuns,
    createPackRun,
    updatePackRun,
    postPackRun,
    voidPackRun,
  } = useProduksi()
  const canEdit = user?.role === 'admin' || user?.role === 'produksi'

  const doneBatches = useMemo(
    () => batches.filter((b) => b.stage === 'done' && !b.voidedAt),
    [batches],
  )

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StageFilter>('semua')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const pendingCreateId = useRef<string | null>(null)

  const counts = useMemo(() => {
    const tally = { draft: 0, posted: 0, void: 0 }
    for (const row of packRuns) {
      if (row.voidedAt) tally.void += 1
      else if (row.stage === 'posted') tally.posted += 1
      else tally.draft += 1
    }
    return tally
  }, [packRuns])

  const stats: MetricCardData[] = [
    {
      label: 'Draft',
      value: String(counts.draft),
      delta: 'Belum diposting',
      positive: true,
      spark: [1, 1, 2, 1, 2, 2, 1],
    },
    {
      label: 'Posted',
      value: String(counts.posted),
      delta: 'Stok kemasan',
      positive: true,
      spark: [1, 2, 2, 3, 3, 4, 4],
    },
    {
      label: 'Void',
      value: String(counts.void),
      delta: counts.void ? 'Dibatalkan' : '—',
      positive: counts.void === 0,
      spark: [0, 0, 1, 0, 1, 0, 0],
    },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = packRuns.filter((row) => {
      if (filter === 'void' && !row.voidedAt) return false
      if (filter === 'draft' && (row.stage !== 'draft' || row.voidedAt)) return false
      if (filter === 'posted' && (row.stage !== 'posted' || row.voidedAt)) return false
      if (!q) return true
      const batch = batches.find((b) => b.id === row.batchId)
      return [row.id, row.batchId, row.sourceSku, batch?.inputName].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      id: (row) => row.id,
      batch: (row) => row.batchId,
      qty: (row) => sumPackRunOutQty(row),
      date: (row) => row.createdAt,
      stage: (row) => packStageLabel(row),
    })
  }, [packRuns, batches, search, filter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const active =
    drawerId != null ? (packRuns.find((row) => row.id === drawerId) ?? null) : null
  const drawerOpen = creating || drawerId != null

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const id = pendingCreateId.current
    if (!id) return
    const row = packRuns.find((item) => item.id === id)
    if (!row) return
    pendingCreateId.current = null
    setCreating(false)
    setDrawerId(id)
    setToast(`${id} disimpan sebagai draft`)
  }, [packRuns])

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function closeDrawer() {
    setCreating(false)
    setDrawerId(null)
    setPostOpen(false)
    setVoidOpen(false)
  }

  return (
    <OpsPage>
      <FinanceStatGrid stats={stats} />

      <OpsPanel>
        <OpsPanelHeader
          title="Packing & grading"
          description="Pecah output giling menjadi SKU kemasan/grade. Posting memindahkan stok dari output batch ke lokasi kemasan."
          action={<FinanceToast message={toast} />}
        />

        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari pack, batch, SKU…"
          filter={filter}
          filterOptions={FILTERS}
          onFilterChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          actionLabel={canEdit ? 'Pack baru' : undefined}
          onAction={
            canEdit
              ? () => {
                  setDrawerId(null)
                  setCreating(true)
                }
              : undefined
          }
        />

        <FinanceTable minWidth="820px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Pack" sortKey="id" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Batch"
              sortKey="batch"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh>Sumber SKU</FinanceTh>
            <FinanceSortTh label="Qty" sortKey="qty" sort={sort} onSort={handleSort} align="right" />
            <FinanceSortTh label="Tanggal" sortKey="date" sort={sort} onSort={handleSort} />
            <FinanceSortTh label="Status" sortKey="stage" sort={sort} onSort={handleSort} />
            <FinanceTh align="center" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Belum ada pack run yang cocok." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {row.id}
                  </FinanceTd>
                  <FinanceTd mono>{row.batchId}</FinanceTd>
                  <FinanceTd>{row.sourceSku}</FinanceTd>
                  <FinanceTd mono align="right">
                    {formatKg(sumPackRunOutQty(row))}
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {formatDate(dateKey(row.createdAt))}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={packStageLabel(row)}
                      tone={packStageTone(row)}
                    />
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
                      {row.stage === 'draft' && !row.voidedAt && canEdit
                        ? 'Ubah'
                        : 'Detail'}
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
      </OpsPanel>

      {drawerOpen ? (
        <PackDrawer
          key={creating ? 'new' : `${drawerId}-${active?.stage ?? 'wait'}`}
          row={creating ? null : active}
          waiting={!creating && drawerId != null && !active}
          doneBatches={doneBatches}
          canEdit={canEdit}
          onClose={closeDrawer}
          onCreate={(input) => {
            const predicted = nextPackRunId(packRuns)
            createPackRun(input)
            pendingCreateId.current = predicted
            return undefined
          }}
          onSaveLines={(id, lines) => {
            const err = updatePackRun(id, lines)
            if (err) return err
            setToast(`${id} disimpan`)
            return undefined
          }}
          onAskPost={() => setPostOpen(true)}
          onAskVoid={() => setVoidOpen(true)}
        />
      ) : null}

      <ConfirmDialog
        open={postOpen && active != null}
        title="Posting pack"
        description={
          active
            ? `Pack ${active.id} memindahkan ${formatKg(sumPackRunOutQty(active))} dari ${active.sourceSku} ke baris kemasan.`
            : undefined
        }
        confirmLabel="Posting"
        onClose={() => setPostOpen(false)}
        onConfirm={() => {
          if (!active) return
          const err = postPackRun(active.id)
          setPostOpen(false)
          setToast(err ?? `${active.id} diposting`)
        }}
      />

      <ConfirmDialog
        open={voidOpen && active != null}
        title="Void pack"
        description={
          active
            ? `Pack ${active.id} dibatalkan dan stok dikembalikan ke output batch.`
            : undefined
        }
        confirmLabel="Void"
        danger
        onClose={() => setVoidOpen(false)}
        onConfirm={() => {
          if (!active) return
          const err = voidPackRun(active.id)
          setVoidOpen(false)
          setToast(err ?? `${active.id} di-void`)
        }}
      />
    </OpsPage>
  )
}

function PackDrawer({
  row,
  waiting,
  doneBatches,
  canEdit,
  onClose,
  onCreate,
  onSaveLines,
  onAskPost,
  onAskVoid,
}: {
  row: PackRun | null
  waiting: boolean
  doneBatches: ProductionBatch[]
  canEdit: boolean
  onClose: () => void
  onCreate: (input: {
    batchId: string
    sourceSku: string
    lines: PackRunLine[]
  }) => string | undefined
  onSaveLines: (id: string, lines: PackRunLine[]) => string | undefined
  onAskPost: () => void
  onAskVoid: () => void
}) {
  const editable = canEdit && row != null && row.stage === 'draft' && !row.voidedAt
  const isNew = row == null

  const [batchId, setBatchId] = useState(row?.batchId ?? '')
  const [sourceSku, setSourceSku] = useState(row?.sourceSku ?? '')
  const [lines, setLines] = useState<PackRunLine[]>(() =>
    row?.lines?.length ? row.lines : [],
  )
  const [qtyStrings, setQtyStrings] = useState<string[]>(() =>
    (row?.lines ?? []).map((l) => String(l.qty).replace('.', ',')),
  )
  const [error, setError] = useState<string | undefined>()
  const { stocks } = usePersediaanStore()

  const batch = doneBatches.find((b) => b.id === batchId)
  const sourceOutputs = useMemo(
    () =>
      batch?.outputs.filter((o) => o.qty > 0) ?? [],
    [batch],
  )
  const sourceLine = sourceOutputs.find((o) => o.sku === sourceSku)
  const sourceLocation = batch?.toLocation ?? row?.lines[0]?.location
  const sourceOnHand = useMemo(() => {
    if (!sourceSku || !sourceLocation) return null
    const key = stockKey(sourceSku, sourceLocation)
    return stocks.find((s) => stockKey(s.sku, s.location) === key)?.qty ?? 0
  }, [stocks, sourceSku, sourceLocation])

  useEffect(() => {
    if (row != null || !batch || !sourceLine) return
    const suggested = suggestPackLines(sourceLine, batch)
    setLines(suggested)
    setQtyStrings(suggested.map(() => ''))
  }, [row, batch, sourceLine, sourceSku])

  function buildLines(): PackRunLine[] | string {
    return parseLinesFromForm(lines, qtyStrings)
  }

  function saveNew() {
    if (!batch || !sourceSku) {
      setError('Pilih batch selesai dan SKU sumber.')
      return
    }
    const parsed = buildLines()
    if (typeof parsed === 'string') {
      setError(parsed)
      return
    }
    const err = onCreate({ batchId: batch.id, sourceSku, lines: parsed })
    if (err) setError(err)
  }

  function saveDraft() {
    if (!row) return
    const parsed = buildLines()
    if (typeof parsed === 'string') {
      setError(parsed)
      return
    }
    const err = onSaveLines(row.id, parsed)
    if (err) setError(err)
  }

  function updateLine(index: number, patch: Partial<PackRunLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
    setError(undefined)
  }

  function updateQty(index: number, value: string) {
    setQtyStrings((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    setError(undefined)
  }

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={row?.id ?? 'Pack baru'}
      subtitle={
        row
          ? `${row.batchId} · ${row.sourceSku}`
          : 'Draft pack dari batch selesai'
      }
      badge={
        row ? (
          <StatusPill label={packStageLabel(row)} tone={packStageTone(row)} />
        ) : undefined
      }
      footer={
        <>
          {isNew && canEdit ? (
            <button
              type="button"
              onClick={saveNew}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Simpan draft
            </button>
          ) : null}
          {editable ? (
            <button
              type="button"
              onClick={saveDraft}
              className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
            >
              Simpan perubahan
            </button>
          ) : null}
          {canEdit && row?.stage === 'draft' && !row.voidedAt ? (
            <button
              type="button"
              onClick={onAskPost}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Posting
            </button>
          ) : null}
          {canEdit && row?.stage === 'posted' && !row.voidedAt ? (
            <button
              type="button"
              onClick={onAskVoid}
              className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
            >
              Void
            </button>
          ) : null}
        </>
      }
    >
      {waiting ? (
        <p className="text-[13px] text-muted">Memuat pack…</p>
      ) : isNew && canEdit ? (
        <div className="space-y-3">
          <Select
            id="pack-batch"
            label="Batch selesai"
            requiredMark
            value={batchId}
            placeholder="Pilih batch done"
            options={doneBatches.map((b) => ({
              value: b.id,
              label: b.id,
              description: `${b.inputName} · ${formatDate(b.date)}`,
            }))}
            onChange={(id) => {
              setBatchId(id)
              setSourceSku('')
              setLines([])
              setQtyStrings([])
              setError(undefined)
            }}
          />
          <Select
            id="pack-source"
            label="SKU output sumber"
            requiredMark
            value={sourceSku}
            placeholder={batchId ? 'Pilih output giling' : 'Pilih batch dulu'}
            options={sourceOutputs.map((o) => ({
              value: o.sku,
              label: o.sku,
              description: `${o.productName} · ${formatKg(o.qty)}`,
            }))}
            onChange={(sku) => {
              setSourceSku(sku)
              setError(undefined)
            }}
          />
          {sourceSku && sourceLocation && sourceOnHand != null ? (
            <p className="text-[12px] text-muted">
              Stok {sourceSku} di {sourceLocation}:{' '}
              <span className="num font-medium text-ink">{formatKg(sourceOnHand)}</span>
            </p>
          ) : null}
          {lines.length > 0 ? (
            <PackLinesEditor
              lines={lines}
              qtyStrings={qtyStrings}
              editable
              onUpdateLine={updateLine}
              onUpdateQty={updateQty}
            />
          ) : null}
          {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
          {doneBatches.length === 0 ? (
            <p className="text-[12px] text-muted">Belum ada batch selesai.</p>
          ) : null}
        </div>
      ) : editable && row ? (
        <div className="space-y-3">
          {sourceSku && sourceLocation && sourceOnHand != null ? (
            <p className="text-[12px] text-muted">
              Stok sumber {sourceSku} di {sourceLocation}:{' '}
              <span className="num font-medium text-ink">{formatKg(sourceOnHand)}</span>
            </p>
          ) : null}
          <PackLinesEditor
            lines={lines}
            qtyStrings={qtyStrings}
            editable
            onUpdateLine={updateLine}
            onUpdateQty={updateQty}
          />
          {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
        </div>
      ) : row ? (
        <div className="space-y-4">
          <DrawerSection label="Dokumen">
            <DrawerFacts
              items={[
                ['Batch', row.batchId],
                ['SKU sumber', row.sourceSku],
                ['Total qty', formatKg(sumPackRunOutQty(row))],
                row.postedAt
                  ? ['Diposting', formatDate(dateKey(row.postedAt))]
                  : null,
                row.voidedAt ? ['Void', formatDate(dateKey(row.voidedAt))] : null,
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Baris kemasan">
            <PackLinesEditor
              lines={row.lines}
              qtyStrings={row.lines.map((l) => String(l.qty))}
              editable={false}
              onUpdateLine={() => {}}
              onUpdateQty={() => {}}
            />
          </DrawerSection>
        </div>
      ) : null}
    </DetailDrawer>
  )
}

function PackLinesEditor({
  lines,
  qtyStrings,
  editable,
  onUpdateLine,
  onUpdateQty,
}: {
  lines: PackRunLine[]
  qtyStrings: string[]
  editable: boolean
  onUpdateLine: (index: number, patch: Partial<PackRunLine>) => void
  onUpdateQty: (index: number, value: string) => void
}) {
  return (
    <ul className="space-y-3">
      {lines.map((line, index) => (
        <li
          key={`${line.sku}-${index}`}
          className="rounded-xl border border-line/80 bg-surface/70 px-3 py-3"
        >
          <p className="text-[13px] font-medium text-ink">{line.productName}</p>
          <p className="num mt-0.5 text-[11px] text-muted">
            {line.sku}
            {line.grade ? ` · grade ${line.grade}` : ''}
          </p>
          {editable ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <TextField
                id={`pack-qty-${index}`}
                label="Qty"
                inputMode="decimal"
                value={qtyStrings[index] ?? ''}
                onChange={(e) => onUpdateQty(index, e.target.value)}
              />
              <Select
                id={`pack-loc-${index}`}
                label="Lokasi"
                value={line.location}
                options={PRODUKSI_LOCATIONS.map((loc) => ({
                  value: loc,
                  label: loc,
                }))}
                onChange={(loc) => onUpdateLine(index, { location: loc })}
              />
            </div>
          ) : (
            <p className="num mt-2 text-[12px] text-muted">
              {formatKg(line.qty)} · {line.location}
              {line.bags != null ? ` · ${line.bags} sak` : ''}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
