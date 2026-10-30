import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import {
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
  rowNumber,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { StageLabel } from '@/components/produksi/StatusLabel'
import { TextField } from '@/components/ui/TextField'
import { EyeIcon } from '@/components/ui/icons'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import {
  actualRendemen,
  formatDate,
  formatQty,
  massBalance,
  sumOutputs,
  type BatchLine,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'
import { usePageSize } from '@/features/settings/usePageSize'

type Props = {
  batches: ProductionBatch[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdateOutputs: (id: string, outputs: BatchLine[]) => void
  onGoToBatch: (id: string) => void
}

function buildStats(batches: ProductionBatch[]): MetricCardData[] {
  const editable = batches.filter((b) =>
    ['draft', 'submitted', 'approved', 'processing', 'rejected'].includes(
      b.stage,
    ),
  )
  const imbalances = batches.filter(
    (b) => b.stage === 'done' && Math.abs(massBalance(b)) > b.inputQty * 0.08,
  )
  return [
    {
      label: 'Batch terbuka',
      value: String(editable.length),
      delta: 'bisa diedit I/O',
      positive: true,
      spark: [2, 3, 3, 4, 3, 4, 4],
    },
    {
      label: 'Selisih massa besar',
      value: String(imbalances.length),
      delta: '>8% input',
      positive: imbalances.length === 0,
      spark: [1, 0, 1, 1, 0, 0, 1],
    },
    {
      label: 'Total input',
      value: formatQty(
        batches.reduce((s, b) => s + b.inputQty, 0),
        'kg',
      ),
      delta: 'semua batch',
      positive: true,
      spark: [40, 42, 45, 48, 50, 52, 55],
    },
  ]
}

export function InputOutputView({
  batches,
  selectedId,
  onSelect,
  onUpdateOutputs,
  onGoToBatch,
}: Props) {
  const PAGE_SIZE = usePageSize()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProductionBatch | null>(null)
  const [draftOutputs, setDraftOutputs] = useState<BatchLine[]>([])

  const stats = useMemo(() => buildStats(batches), [batches])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => setPage(1), [search])

  useEffect(() => {
    if (!selectedId) return
    const row = batches.find((b) => b.id === selectedId)
    if (row) {
      setDetail(row)
      setDraftOutputs(row.outputs.map((o) => ({ ...o })))
    }
  }, [selectedId, batches])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return batches.filter((b) => {
      if (!q) return true
      return [b.id, b.inputName, b.inputSku].some((v) =>
        v.toLowerCase().includes(q),
      )
    })
  }, [batches, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const canEdit =
    detail &&
    !['done', 'void'].includes(detail.stage)

  function openDetail(row: ProductionBatch) {
    setDetail(row)
    setDraftOutputs(row.outputs.map((o) => ({ ...o })))
    onSelect(row.id)
  }

  function saveOutputs() {
    if (!detail || !canEdit) return
    onUpdateOutputs(detail.id, draftOutputs)
    setToast('Output diperbarui')
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />
      <FinanceToast message={toast} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="text-[14px] font-semibold text-ink">Input–Output</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Neraca massa gabah → beras & sampingan
          </p>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari batch atau SKU input…"
          filter="semua"
          filterLabel="Tampil"
          filterOptions={[{ value: 'semua', label: 'Semua batch' }]}
          onFilterChange={() => undefined}
        />

        <FinanceTable>
          <FinanceThead>
            <FinanceTh className="w-10">#</FinanceTh>
            <FinanceTh>Batch</FinanceTh>
            <FinanceTh>Input</FinanceTh>
            <FinanceTh>Σ Output</FinanceTh>
            <FinanceTh>Selisih</FinanceTh>
            <FinanceTh>Status</FinanceTh>
            <FinanceTh align="center">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={7} message="Tidak ada data." />
            ) : (
              rows.map((row, index) => {
                const bal = massBalance(row)
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{row.id}</p>
                        <p className="truncate text-[11px] text-muted">
                          {formatDate(row.date)}
                        </p>
                      </div>
                    </FinanceTd>
                    <FinanceTd mono>
                      {formatQty(row.inputQty, row.inputUnit)}
                    </FinanceTd>
                    <FinanceTd mono>
                      {formatQty(sumOutputs(row), 'kg')}
                    </FinanceTd>
                    <FinanceTd mono>
                      <span
                        className={
                          Math.abs(bal) > row.inputQty * 0.08
                            ? 'text-amber-700'
                            : undefined
                        }
                      >
                        {bal > 0 ? '+' : ''}
                        {formatQty(bal, 'kg')}
                      </span>
                    </FinanceTd>
                    <FinanceTd>
                      <StageLabel stage={row.stage} />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                        aria-label={`Detail ${row.id}`}
                      >
                        <EyeIcon className="size-[18px]" />
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

      {detail ? (
        <DetailDrawer
          open
          onClose={() => {
            setDetail(null)
            onSelect(null)
          }}
          title={detail.id}
          subtitle="Input–Output"
          badge={<StageLabel stage={detail.stage} />}
          footer={
            <>
              {canEdit ? (
                <button
                  type="button"
                  onClick={saveOutputs}
                  className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
                >
                  Simpan output
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onGoToBatch(detail.id)}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Ke kartu batch
              </button>
            </>
          }
        >
          <DrawerHero
            label="Selisih massa"
            amount={`${massBalance(detail) > 0 ? '+' : ''}${formatQty(massBalance({ ...detail, outputs: draftOutputs.length ? draftOutputs : detail.outputs }), 'kg')}`}
            hint={`Input ${formatQty(detail.inputQty, detail.inputUnit)}`}
          />
          <DrawerSection label="Input">
            <DrawerFacts
              items={[
                ['SKU', detail.inputSku],
                ['Nama', detail.inputName],
                ['Qty', formatQty(detail.inputQty, detail.inputUnit)],
                ['Dari', detail.fromLocation],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Output">
            <div className="space-y-2">
              {(canEdit ? draftOutputs : detail.outputs).map((line, index) => (
                <div key={line.sku} className="grid grid-cols-[1fr_110px] gap-2">
                  <div className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2 text-[13px]">
                    <p className="font-medium text-ink">{line.productName}</p>
                    <p className="text-[11px] text-muted">{line.sku}</p>
                  </div>
                  {canEdit ? (
                    <TextField
                      id={`io-${line.sku}`}
                      label="Qty"
                      value={line.qty ? String(line.qty) : ''}
                      inputMode="decimal"
                      onChange={(e) => {
                        const qty = Math.max(
                          0,
                          Number(e.target.value.replace(/[^\d.]/g, '')) || 0,
                        )
                        setDraftOutputs((list) =>
                          list.map((o, i) =>
                            i === index ? { ...o, qty } : o,
                          ),
                        )
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-end font-mono text-[13px] text-ink">
                      {formatQty(line.qty, line.unit)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DrawerSection>
          <DrawerSection label="Ringkas">
            <DrawerFacts
              items={[
                [
                  'Σ Output',
                  formatQty(
                    sumOutputs({
                      ...detail,
                      outputs: draftOutputs.length
                        ? draftOutputs
                        : detail.outputs,
                    }),
                    'kg',
                  ),
                ],
                [
                  'Rendemen',
                  `${actualRendemen({
                    ...detail,
                    outputs: draftOutputs.length
                      ? draftOutputs
                      : detail.outputs,
                  }).toFixed(1)}%`,
                ],
              ]}
            />
          </DrawerSection>
        </DetailDrawer>
      ) : null}
    </div>
  )
}
