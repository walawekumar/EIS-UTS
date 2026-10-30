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
import { StatusPill } from '@/components/keuangan/StatusPill'
import { DetailDrawer, DrawerFacts, DrawerSection } from '@/components/ops/DetailDrawer'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import type { LotQcInput } from '@/features/pembelian/PembelianContext'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import {
  formatDate,
  formatNumber,
  getLotQc,
  getSupplier,
  parseNumber,
  type LotQc,
  type LotQcGrade,
  type Purchase,
} from '@/features/pembelian/pembelian-data'
import { usePageSize } from '@/features/settings/usePageSize'

const FILTERS = [
  { value: 'semua' as const, label: 'Semua lot' },
  { value: 'belum' as const, label: 'Belum QC' },
  { value: 'lulus' as const, label: 'Lulus' },
  { value: 'gagal' as const, label: 'Tidak lulus' },
]

const GRADES: { value: LotQcGrade; label: string }[] = [
  { value: 'A', label: 'Grade A' },
  { value: 'B', label: 'Grade B' },
  { value: 'C', label: 'Grade C' },
  { value: 'reject', label: 'Reject' },
]

type QcFilter = (typeof FILTERS)[number]['value']
type SortKey = 'lot' | 'purchase' | 'date' | 'grade'

function qcTone(qc: LotQc | undefined): 'neutral' | 'good' | 'warn' | 'danger' {
  if (!qc) return 'warn'
  if (qc.passed) return 'good'
  if (qc.overrideReason) return 'warn'
  return 'danger'
}

function qcLabel(qc: LotQc | undefined): string {
  if (!qc) return 'Belum'
  if (qc.passed) return 'Lulus'
  if (qc.overrideReason) return 'Override'
  return 'Gagal'
}

export function QcPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const { purchases, lotQc, upsertLotQc } = usePembelian()
  const canEdit =
    user?.role === 'admin' || user?.role === 'pembelian' || user?.role === 'gudang'

  const lots = useMemo(
    () => purchases.filter((p) => p.lotId && !p.voidedAt),
    [purchases],
  )

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<QcFilter>('semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const summary = useMemo(() => {
    let belum = 0
    let lulus = 0
    let gagal = 0
    for (const purchase of lots) {
      const qc = getLotQc(lotQc, purchase.lotId!)
      if (!qc) belum += 1
      else if (qc.passed) lulus += 1
      else gagal += 1
    }
    return { belum, lulus, gagal }
  }, [lots, lotQc])

  const stats: MetricCardData[] = [
    {
      label: 'Lot',
      value: String(lots.length),
      delta: 'Dari timbang',
      positive: true,
      spark: [2, 2, 3, 3, 4, 4, 5],
    },
    {
      label: 'Belum QC',
      value: String(summary.belum),
      delta: summary.belum > 0 ? 'Perlu diisi' : 'Lengkap',
      positive: summary.belum === 0,
      spark: [2, 2, 1, 2, 1, 1, 1],
    },
    {
      label: 'Lulus',
      value: String(summary.lulus),
      delta: 'Siap terima',
      positive: true,
      spark: [1, 1, 2, 2, 3, 3, 4],
    },
    {
      label: 'Tidak lulus',
      value: String(summary.gagal),
      delta: 'Perlu override admin',
      positive: summary.gagal === 0,
      spark: [1, 1, 1, 2, 1, 2, 1],
    },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = lots.filter((purchase) => {
      const qc = getLotQc(lotQc, purchase.lotId!)
      if (filter === 'belum' && qc) return false
      if (filter === 'lulus' && !qc?.passed) return false
      if (filter === 'gagal' && (!qc || qc.passed)) return false
      if (dateFrom && purchase.date < dateFrom) return false
      if (dateTo && purchase.date > dateTo) return false
      if (!q) return true
      const supplier = getSupplier(purchase.supplierId)?.name
      return [purchase.lotId, purchase.id, supplier, purchase.grain, qc?.grade].some((v) =>
        v?.toLowerCase().includes(q),
      )
    })
    return sortBy(base, sort, {
      lot: (p) => p.lotId ?? '',
      purchase: (p) => p.id,
      date: (p) => p.date,
      grade: (p) => getLotQc(lotQc, p.lotId!)?.grade ?? '',
    })
  }, [lots, lotQc, search, filter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const active = openId ? (lots.find((p) => p.id === openId) ?? null) : null

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">QC lot</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Kadar air, kotoran, patahan, dan grade. Terima barang butuh lulus atau override admin.
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
          searchPlaceholder="Cari lot, pembelian, pemasok…"
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

        <FinanceTable minWidth="920px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh label="Lot" sortKey="lot" sort={sort} onSort={handleSort} />
            <FinanceSortTh
              label="Pembelian"
              sortKey="purchase"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="right">KA</FinanceTh>
            <FinanceTh align="right">Kotoran</FinanceTh>
            <FinanceTh align="right">Patah</FinanceTh>
            <FinanceSortTh label="Grade" sortKey="grade" sort={sort} onSort={handleSort} />
            <FinanceTh>Status</FinanceTh>
            <FinanceTh align="center" className="w-24">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={9}
                message="Belum ada lot. Lot terbit saat hasil timbang disimpan."
              />
            ) : (
              rows.map((purchase, index) => {
                const qc = getLotQc(lotQc, purchase.lotId!)
                const supplier = getSupplier(purchase.supplierId)
                return (
                  <FinanceTr key={purchase.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {purchase.lotId}
                    </FinanceTd>
                    <FinanceTd>
                      <span className="font-medium">{purchase.id}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {supplier?.name ?? '—'} · {purchase.grain}
                      </span>
                    </FinanceTd>
                    <FinanceTd mono align="right" muted>
                      {qc ? `${formatNumber(qc.moisture)}%` : '—'}
                    </FinanceTd>
                    <FinanceTd mono align="right" muted>
                      {qc ? `${formatNumber(qc.impurity)}%` : '—'}
                    </FinanceTd>
                    <FinanceTd mono align="right" muted>
                      {qc ? `${formatNumber(qc.brokenPct)}%` : '—'}
                    </FinanceTd>
                    <FinanceTd mono>{qc?.grade ?? '—'}</FinanceTd>
                    <FinanceTd>
                      <StatusPill label={qcLabel(qc)} tone={qcTone(qc)} />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <button
                        type="button"
                        onClick={() => setOpenId(purchase.id)}
                        className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-brand-50"
                      >
                        {qc ? 'Ubah' : 'Isi'}
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

      {active?.lotId ? (
        <QcDrawer
          key={`${active.id}-${getLotQc(lotQc, active.lotId)?.at ?? 'new'}`}
          purchase={active}
          qc={getLotQc(lotQc, active.lotId)}
          canEdit={canEdit}
          onClose={() => setOpenId(null)}
          onSave={(input) => {
            const err = upsertLotQc(input)
            if (err) return err
            setToast(`QC ${input.lotId} disimpan`)
            setOpenId(null)
            return undefined
          }}
        />
      ) : null}
    </div>
  )
}

function QcDrawer({
  purchase,
  qc,
  canEdit,
  onClose,
  onSave,
}: {
  purchase: Purchase
  qc: LotQc | undefined
  canEdit: boolean
  onClose: () => void
  onSave: (input: LotQcInput) => string | undefined
}) {
  const supplier = getSupplier(purchase.supplierId)
  const [moisture, setMoisture] = useState(
    qc ? String(qc.moisture).replace('.', ',') : '',
  )
  const [impurity, setImpurity] = useState(
    qc ? String(qc.impurity).replace('.', ',') : '',
  )
  const [broken, setBroken] = useState(
    qc ? String(qc.brokenPct).replace('.', ',') : '',
  )
  const [grade, setGrade] = useState<LotQcGrade>(qc?.grade ?? 'A')
  const [passed, setPassed] = useState(qc?.passed ?? true)
  const [note, setNote] = useState(qc?.note ?? '')
  const [error, setError] = useState<string | undefined>()

  function save() {
    const moistureN = parseNumber(moisture)
    const impurityN = parseNumber(impurity)
    const brokenN = parseNumber(broken)
    if (moisture.trim() === '' || impurity.trim() === '' || broken.trim() === '') {
      setError('Isi kadar air, kotoran, dan patahan.')
      return
    }
    const err = onSave({
      lotId: purchase.lotId!,
      purchaseId: purchase.id,
      moisture: moistureN,
      impurity: impurityN,
      brokenPct: brokenN,
      grade,
      passed,
      note: note.trim() || undefined,
    })
    if (err) setError(err)
  }

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={purchase.lotId!}
      subtitle={`${purchase.id} · ${supplier?.name ?? '—'}`}
      badge={<StatusPill label={qcLabel(qc)} tone={qcTone(qc)} />}
      footer={
        canEdit ? (
          <button
            type="button"
            onClick={save}
            className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
          >
            Simpan QC
          </button>
        ) : (
          <p className="text-center text-[12px] text-muted">
            Hanya pembelian, gudang, atau admin yang dapat mengisi QC.
          </p>
        )
      }
    >
      <DrawerSection label="Lot">
        <DrawerFacts
          items={[
            ['Pembelian', purchase.id],
            ['Gabah', purchase.grain],
            ['Tanggal', formatDate(purchase.date)],
            qc?.by ? ['Terakhir', qc.by] : null,
            qc?.overrideReason ? ['Override', qc.overrideReason] : null,
          ]}
        />
      </DrawerSection>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="qc-moisture"
            label="Kadar air (%)"
            requiredMark
            inputMode="decimal"
            value={moisture}
            disabled={!canEdit}
            onChange={(e) => setMoisture(e.target.value)}
          />
          <TextField
            id="qc-impurity"
            label="Kotoran (%)"
            requiredMark
            inputMode="decimal"
            value={impurity}
            disabled={!canEdit}
            onChange={(e) => setImpurity(e.target.value)}
          />
          <TextField
            id="qc-broken"
            label="Patahan (%)"
            requiredMark
            inputMode="decimal"
            value={broken}
            disabled={!canEdit}
            onChange={(e) => setBroken(e.target.value)}
          />
          <Select
            id="qc-grade"
            label="Grade"
            requiredMark
            value={grade}
            options={GRADES}
            onChange={(value) => {
              if (!canEdit) return
              setGrade(value)
              if (value === 'reject') setPassed(false)
            }}
          />
        </div>
        <Switch
          id="qc-passed"
          label="Lot lulus QC"
          checked={passed}
          onChange={(value) => {
            if (!canEdit) return
            setPassed(value)
          }}
        />
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Catatan</span>
          <textarea
            value={note}
            disabled={!canEdit}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Catatan mutu, opsional"
            className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/55 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
          />
        </label>
        {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
      </div>
    </DetailDrawer>
  )
}
