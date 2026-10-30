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
import {
  DetailDrawer,
  DrawerFacts,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { StageLabel } from '@/components/produksi/StatusLabel'
import { PromptDialog } from '@/components/ui/ConfirmDialog'
import { EyeIcon } from '@/components/ui/icons'
import { useAuth } from '@/features/auth/AuthContext'
import {
  actualRendemen,
  BATCH_STAGE_LABEL,
  buildBatchStats,
  formatDate,
  formatQty,
  massBalance,
  sumOutputs,
  type BatchStage,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'
import { usePageSize } from '@/features/settings/usePageSize'

type SortKey = 'id' | 'date' | 'operator' | 'inputQty' | 'stage' | 'rendemen'
type StageFilter = 'semua' | BatchStage

type Props = {
  batches: ProductionBatch[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onSubmit: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
  onStart: (id: string) => string | undefined
  onComplete: (id: string) => string | undefined
  onVoid: (id: string, reason: string) => string | undefined
  onDelete: (id: string) => void
  onGoTo: (section: 'input-output' | 'rendemen', id: string) => void
}

export function BatchView({
  batches,
  selectedId,
  onSelect,
  onCreate,
  onSubmit,
  onApprove,
  onReject,
  onStart,
  onComplete,
  onVoid,
  onDelete,
  onGoTo,
}: Props) {
  const { user } = useAuth()
  const canApprove = user?.role === 'admin'
  const PAGE_SIZE = usePageSize()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StageFilter>('semua')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProductionBatch | null>(null)
  const [promptKind, setPromptKind] = useState<'reject' | 'void' | null>(null)

  const stats = useMemo(() => buildBatchStats(batches), [batches])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => setPage(1), [search, filter])

  useEffect(() => {
    if (!selectedId) return
    const row = batches.find((b) => b.id === selectedId)
    if (row) setDetail(row)
  }, [selectedId, batches])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = batches.filter((b) => {
      if (filter !== 'semua' && b.stage !== filter) return false
      if (!q) return true
      return [
        b.id,
        b.operator,
        b.inputName,
        b.inputSku,
        b.fromLocation,
        b.toLocation,
        BATCH_STAGE_LABEL[b.stage],
      ].some((v) => v.toLowerCase().includes(q))
    })
    return sortBy(base, sort, {
      id: (b) => b.id,
      date: (b) => b.date,
      operator: (b) => b.operator,
      inputQty: (b) => b.inputQty,
      stage: (b) => b.stage,
      rendemen: (b) => actualRendemen(b),
    })
  }, [batches, search, filter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openDetail(row: ProductionBatch) {
    setDetail(row)
    onSelect(row.id)
  }

  function handlePrint(row: ProductionBatch) {
    printBukti(
      row.id,
      [
        { label: 'Tanggal', value: formatDate(row.date) },
        { label: 'Status', value: BATCH_STAGE_LABEL[row.stage] },
        { label: 'Operator', value: row.operator },
        {
          label: 'Input',
          value: `${row.inputName} · ${formatQty(row.inputQty, row.inputUnit)}`,
        },
        { label: 'Dari', value: row.fromLocation },
        { label: 'Proses', value: row.processLocation },
        { label: 'Hasil ke', value: row.toLocation },
        {
          label: 'Output total',
          value: formatQty(sumOutputs(row), 'kg'),
        },
        {
          label: 'Rendemen',
          value: `${actualRendemen(row).toFixed(1)}% (target ${row.targetRendemen}%)`,
        },
        {
          label: 'Neraca massa',
          value: formatQty(massBalance(row), 'kg'),
        },
        { label: 'Catatan', value: row.note || '—' },
      ],
      { subtitle: 'Kartu batch giling', module: 'Produksi' },
    )
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />
      <FinanceToast message={toast} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Batch giling</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Draft → approve → proses → selesai (posting stok)
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="h-10 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900"
          >
            + Batch
          </button>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari ID, operator, SKU…"
          filter={filter}
          filterLabel="Status"
          filterOptions={[
            { value: 'semua', label: 'Semua status' },
            ...(
              Object.keys(BATCH_STAGE_LABEL) as BatchStage[]
            ).map((s) => ({ value: s, label: BATCH_STAGE_LABEL[s] })),
          ]}
          onFilterChange={setFilter}
        />

        <FinanceTable>
          <FinanceThead>
            <FinanceTh className="w-10">#</FinanceTh>
            <FinanceSortTh label="Batch" sortKey="id" sort={sort} onSort={handleSort} />
            <FinanceSortTh label="Tanggal" sortKey="date" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Operator"
              sortKey="operator"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Input"
              sortKey="inputQty"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Rendemen"
              sortKey="rendemen"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Status"
              sortKey="stage"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Tidak ada batch." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{row.id}</p>
                      <p className="truncate text-[11px] text-muted">
                        {row.inputName}
                      </p>
                    </div>
                  </FinanceTd>
                  <FinanceTd>{formatDate(row.date)}</FinanceTd>
                  <FinanceTd>{row.operator}</FinanceTd>
                  <FinanceTd mono>
                    {formatQty(row.inputQty, row.inputUnit)}
                  </FinanceTd>
                  <FinanceTd mono>{actualRendemen(row).toFixed(1)}%</FinanceTd>
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
        <DetailDrawer
          open
          onClose={() => {
            setDetail(null)
            onSelect(null)
          }}
          title={detail.id}
          subtitle={formatDate(detail.date)}
          badge={<StageLabel stage={detail.stage} />}
          footer={
            <>
              <button
                type="button"
                onClick={() => handlePrint(detail)}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Cetak
              </button>
              <button
                type="button"
                onClick={() => onGoTo('input-output', detail.id)}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Input–Output
              </button>
              {(detail.stage === 'draft' || detail.stage === 'rejected') && (
                <button
                  type="button"
                  onClick={() => {
                    onSubmit(detail.id)
                    setToast('Batch diajukan untuk approve')
                  }}
                  className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
                >
                  Ajukan approve
                </button>
              )}
              {detail.stage === 'submitted' && canApprove && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onApprove(detail.id)
                      setToast('Batch disetujui')
                    }}
                    className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
                  >
                    Setujui
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptKind('reject')}
                    className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
                  >
                    Tolak
                  </button>
                </>
              )}
              {detail.stage === 'approved' && (
                <button
                  type="button"
                  onClick={() => {
                    const je = onStart(detail.id)
                    if (je) {
                      setToast(
                        `Proses giling dimulai · jurnal gagal: ${je}`,
                      )
                    } else {
                      setToast('Proses giling dimulai')
                    }
                  }}
                  className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
                >
                  Mulai proses
                </button>
              )}
              {(detail.stage === 'processing' || detail.stage === 'approved') && (
                <button
                  type="button"
                  onClick={() => {
                    const je = onComplete(detail.id)
                    if (je) {
                      setToast(
                        `Batch selesai — stok diposting · jurnal gagal: ${je}`,
                      )
                    } else {
                      setToast('Batch selesai — stok diposting')
                    }
                  }}
                  className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
                >
                  Selesaikan & post stok
                </button>
              )}
              {detail.stage !== 'void' &&
                detail.stage !== 'draft' &&
                canApprove && (
                  <button
                    type="button"
                    onClick={() => setPromptKind('void')}
                    className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
                  >
                    Void
                  </button>
                )}
              {(detail.stage === 'draft' || detail.stage === 'rejected') && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(detail.id)
                    setDetail(null)
                    onSelect(null)
                    setToast('Draft dihapus')
                  }}
                  className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
                >
                  Hapus draft
                </button>
              )}
            </>
          }
        >
          <DrawerSection label="Identitas">
            <DrawerFacts
              items={[
                ['Operator', detail.operator],
                ['Status', BATCH_STAGE_LABEL[detail.stage]],
                ['Target rendemen', `${detail.targetRendemen}%`],
                ['Aktual', `${actualRendemen(detail).toFixed(1)}%`],
                ['Approve oleh', detail.approvedBy || '—'],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Lokasi">
            <DrawerFacts
              items={[
                ['Dari', detail.fromLocation],
                ['Proses', detail.processLocation],
                ['Hasil ke', detail.toLocation],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Input">
            <DrawerFacts
              items={[
                ['SKU', detail.inputSku],
                ['Produk', detail.inputName],
                ['Qty', formatQty(detail.inputQty, detail.inputUnit)],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Output">
            <ul className="space-y-1.5 text-[13px] text-ink">
              {detail.outputs.map((o) => (
                <li
                  key={o.sku}
                  className="flex justify-between gap-2 rounded-xl border border-line/80 bg-surface/70 px-3 py-2"
                >
                  <span>
                    {o.productName}
                    <span className="ml-1 text-[11px] text-muted">{o.sku}</span>
                  </span>
                  <span className="font-mono text-[12px]">
                    {formatQty(o.qty, o.unit)}
                  </span>
                </li>
              ))}
            </ul>
          </DrawerSection>
          {detail.note ? (
            <DrawerSection label="Catatan">
              <p className="text-[13px] text-muted">{detail.note}</p>
            </DrawerSection>
          ) : null}
          {detail.rejectReason ? (
            <DrawerSection label="Alasan tolak">
              <p className="text-[13px] text-red-700">{detail.rejectReason}</p>
            </DrawerSection>
          ) : null}
        </DetailDrawer>
      ) : null}

      <PromptDialog
        open={promptKind === 'reject' && Boolean(detail)}
        title="Tolak batch"
        description={
          detail ? `Batch ${detail.id} akan ditolak.` : undefined
        }
        label="Alasan penolakan"
        placeholder="Contoh: kadar air terlalu tinggi"
        confirmLabel="Tolak"
        danger
        onClose={() => setPromptKind(null)}
        onConfirm={(reason) => {
          if (!detail) return
          onReject(detail.id, reason)
          setPromptKind(null)
          setToast('Batch ditolak')
        }}
      />

      <PromptDialog
        open={promptKind === 'void' && Boolean(detail)}
        title="Void batch"
        description={
          detail
            ? `Batch ${detail.id} akan di-void. Stok terkait dibalik (MVP lokal).`
            : undefined
        }
        label="Alasan void"
        placeholder="Tulis alasan void…"
        confirmLabel="Void"
        danger
        onClose={() => setPromptKind(null)}
        onConfirm={(reason) => {
          if (!detail) return
          const err = onVoid(detail.id, reason)
          setPromptKind(null)
          if (err) {
            setToast(err)
            return
          }
          setToast('Batch di-void')
        }}
      />
    </div>
  )
}
