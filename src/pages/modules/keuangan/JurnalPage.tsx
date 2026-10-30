import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  FinanceModal,
  ModalActions,
} from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
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
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import {
  type Account,
  type JournalEntry,
  type JournalLine,
  type JournalSourceType,
} from '@/features/keuangan/gl-data'
import { formatIdr, parseIdrInput } from '@/features/keuangan/keuangan-data'
import { usePageSize } from '@/features/settings/usePageSize'

const SOURCE_FILTERS = [
  { value: 'all', label: 'Semua sumber' },
  { value: 'auto', label: 'Otomatis' },
  { value: 'manual', label: 'Manual' },
  { value: 'opening', label: 'Saldo awal' },
  { value: 'reverse', label: 'Pembalikan' },
] as const

type SourceFilter = (typeof SOURCE_FILTERS)[number]['value']

const SOURCE_LABEL: Record<JournalSourceType, string> = {
  auto: 'Otomatis',
  manual: 'Manual',
  opening: 'Saldo awal',
  reverse: 'Pembalikan',
}

const SOURCE_TONE: Record<
  JournalSourceType,
  'neutral' | 'good' | 'warn' | 'muted'
> = {
  auto: 'neutral',
  manual: 'warn',
  opening: 'good',
  reverse: 'muted',
}

type JurnalSortKey = 'date' | 'id' | 'memo' | 'sourceType'

type LineDraft = {
  key: string
  accountId: string
  debit: string
  credit: string
}

function newLineKey(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function emptyLine(): LineDraft {
  return { key: newLineKey(), accountId: '', debit: '', credit: '' }
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatJournalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function accountLabel(accounts: Account[], id: string): string {
  const a = accounts.find((x) => x.id === id)
  return a ? `${a.code} · ${a.name}` : id
}

function buildAccountOptions(
  accounts: Account[],
  selectedIds: string[],
): { value: string; label: string }[] {
  const postable = accounts.filter((a) => a.isPostable && a.active)
  const ids = new Set(postable.map((a) => a.id))
  const list = [...postable]
  for (const sid of selectedIds) {
    if (sid && !ids.has(sid)) {
      const extra = accounts.find((a) => a.id === sid)
      if (extra) list.unshift(extra)
    }
  }
  return list.map((a) => ({
    value: a.id,
    label: `${a.code} · ${a.name}`,
  }))
}

function draftsToLines(
  drafts: LineDraft[],
): { ok: true; lines: JournalLine[] } | { ok: false; error: string } {
  const lines: JournalLine[] = []
  for (const d of drafts) {
    const debit = parseIdrInput(d.debit)
    const credit = parseIdrInput(d.credit)
    if (!d.accountId && debit === 0 && credit === 0) continue
    if (!d.accountId) {
      return { ok: false, error: 'Pilih akun untuk setiap baris yang diisi.' }
    }
    if (debit > 0 && credit > 0) {
      return { ok: false, error: 'Satu baris tidak boleh debit dan kredit sekaligus.' }
    }
    if (debit === 0 && credit === 0) {
      return { ok: false, error: 'Isi debit atau kredit pada baris akun.' }
    }
    lines.push({ accountId: d.accountId, debit, credit })
  }
  if (!lines.length) {
    return { ok: false, error: 'Minimal satu baris jurnal.' }
  }
  return { ok: true, lines }
}

function isBalanced(lines: JournalLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0)
  const c = lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(d - c) < 0.005 && d > 0
}

function finalizeOpeningLines(
  drafts: LineDraft[],
  openingEquityId: string,
): { ok: true; lines: JournalLine[] } | { ok: false; error: string } {
  const parsed = draftsToLines(drafts)
  if (!parsed.ok) return parsed
  const lines = [...parsed.lines]
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const diff = totalDebit - totalCredit
  if (Math.abs(diff) >= 0.005) {
    if (diff > 0) {
      lines.push({ accountId: openingEquityId, debit: 0, credit: diff })
    } else {
      lines.push({ accountId: openingEquityId, debit: -diff, credit: 0 })
    }
  }
  if (!isBalanced(lines)) {
    return { ok: false, error: 'Saldo awal tidak balance setelah ekuitas.' }
  }
  return { ok: true, lines }
}

function journalStatus(j: JournalEntry): {
  label: string
  tone: 'good' | 'muted' | 'danger' | 'warn' | 'neutral'
} {
  if (j.voidedAt) return { label: 'Void', tone: 'danger' }
  if (j.reversedById) return { label: 'Dibalik', tone: 'muted' }
  if (j.reversesId) return { label: 'Pembalikan', tone: 'neutral' }
  return { label: 'Aktif', tone: 'good' }
}

function canReverseJournal(j: JournalEntry): boolean {
  return !j.voidedAt && !j.reversedById
}

type JournalLineEditorProps = {
  drafts: LineDraft[]
  onChange: (drafts: LineDraft[]) => void
  accounts: Account[]
  balanceHint?: string
  showBalanceError?: string | null
}

function JournalLineEditor({
  drafts,
  onChange,
  accounts,
  balanceHint,
  showBalanceError,
}: JournalLineEditorProps) {
  const selectedIds = drafts.map((d) => d.accountId)
  const options = buildAccountOptions(accounts, selectedIds)
  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const d of drafts) {
      debit += parseIdrInput(d.debit)
      credit += parseIdrInput(d.credit)
    }
    return { debit, credit }
  }, [drafts])

  function updateLine(key: string, patch: Partial<LineDraft>) {
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  return (
    <div className="space-y-3">
      {showBalanceError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {showBalanceError}
        </p>
      ) : null}
      {balanceHint ? (
        <p className="text-[12px] text-muted">{balanceHint}</p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-[640px] w-full text-[12px]">
          <thead>
            <tr className="border-b border-line bg-surface/60 text-left text-muted">
              <th className="px-2 py-2 font-medium">Akun</th>
              <th className="w-32 px-2 py-2 font-medium">Debit</th>
              <th className="w-32 px-2 py-2 font-medium">Kredit</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((row) => (
              <tr key={row.key} className="border-b border-line/70 last:border-0">
                <td className="px-2 py-1.5">
                  <Select
                    label=""
                    value={row.accountId}
                    options={[
                      { value: '', label: 'Pilih akun…' },
                      ...options,
                    ]}
                    onChange={(accountId) => updateLine(row.key, { accountId })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.debit}
                    placeholder="0"
                    onChange={(e) =>
                      updateLine(row.key, {
                        debit: e.target.value,
                        credit: e.target.value ? '' : row.credit,
                      })
                    }
                    className="h-9 w-full rounded-lg border border-line px-2 font-mono text-[12px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.credit}
                    placeholder="0"
                    onChange={(e) =>
                      updateLine(row.key, {
                        credit: e.target.value,
                        debit: e.target.value ? '' : row.debit,
                      })
                    }
                    className="h-9 w-full rounded-lg border border-line px-2 font-mono text-[12px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    disabled={drafts.length <= 1}
                    onClick={() =>
                      onChange(drafts.filter((d) => d.key !== row.key))
                    }
                    className="rounded-lg px-2 py-1 text-muted transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                    aria-label="Hapus baris"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface/40 font-mono text-[11px]">
              <td className="px-2 py-2 text-right text-muted">Total</td>
              <td className="px-2 py-2">{formatIdr(totals.debit)}</td>
              <td className="px-2 py-2">{formatIdr(totals.credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onChange([...drafts, emptyLine()])}
        className="text-[12px] font-medium text-brand-800 transition hover:text-brand-900"
      >
        + Tambah baris
      </button>
    </div>
  )
}

export function JurnalPage() {
  const PAGE_SIZE = usePageSize()
  const {
    journals,
    failedPosts,
    accounts,
    accountMap,
    postJournalEntry,
    reverseJournalEntry,
    retryFailedPost,
  } = useFinanceStore()

  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<JurnalSortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [detail, setDetail] = useState<JournalEntry | null>(null)
  const [reverseTarget, setReverseTarget] = useState<JournalEntry | null>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [openingOpen, setOpeningOpen] = useState(false)
  const [entryDate, setEntryDate] = useState(todayIsoDate)
  const [manualMemo, setManualMemo] = useState('')
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>(() => [
    emptyLine(),
    emptyLine(),
  ])
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!detail) return
    const fresh = journals.find((j) => j.id === detail.id)
    if (fresh) setDetail(fresh)
  }, [journals, detail])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = journals.filter((j) => {
      if (sourceFilter !== 'all' && j.sourceType !== sourceFilter) return false
      if (dateFrom && j.date < dateFrom) return false
      if (dateTo && j.date > dateTo) return false
      if (!q) return true
      return (
        j.id.toLowerCase().includes(q) ||
        j.memo.toLowerCase().includes(q) ||
        (j.sourceKey ?? '').toLowerCase().includes(q) ||
        SOURCE_LABEL[j.sourceType].toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      date: (r) => r.date,
      id: (r) => r.id,
      memo: (r) => r.memo,
      sourceType: (r) => r.sourceType,
    })
  }, [journals, search, sourceFilter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: JurnalSortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openManual() {
    setEntryDate(todayIsoDate())
    setManualMemo('')
    setLineDrafts([emptyLine(), emptyLine()])
    setFormError(null)
    setManualOpen(true)
  }

  function openOpening() {
    setEntryDate(todayIsoDate())
    setLineDrafts([emptyLine(), emptyLine()])
    setFormError(null)
    setOpeningOpen(true)
  }

  function submitManual() {
    const parsed = draftsToLines(lineDrafts)
    if (!parsed.ok) {
      setFormError(parsed.error)
      return
    }
    if (!isBalanced(parsed.lines)) {
      setFormError('Debit dan kredit harus balance sebelum posting.')
      return
    }
    const memo = manualMemo.trim() || 'Jurnal manual'
    const err = postJournalEntry({
      date: entryDate,
      memo,
      sourceType: 'manual',
      manual: true,
      lines: parsed.lines,
    })
    if (err) {
      setFormError(err)
      return
    }
    setManualOpen(false)
    setPage(1)
    setToast(`Jurnal ${memo} diposting`)
  }

  function submitOpening() {
    const equityId = accountMap.openingEquity
    if (!equityId) {
      setFormError('Akun openingEquity belum dipetakan di Pemetaan Akun.')
      return
    }
    const parsed = finalizeOpeningLines(lineDrafts, equityId)
    if (!parsed.ok) {
      setFormError(parsed.error)
      return
    }
    const err = postJournalEntry({
      date: entryDate,
      memo: 'Saldo awal',
      sourceType: 'opening',
      manual: true,
      lines: parsed.lines,
    })
    if (err) {
      setFormError(err)
      return
    }
    setOpeningOpen(false)
    setPage(1)
    setToast('Saldo awal diposting')
  }

  function confirmReverse() {
    if (!reverseTarget) return
    const err = reverseTarget.sourceKey
      ? reverseJournalEntry({ sourceKey: reverseTarget.sourceKey })
      : reverseJournalEntry({ id: reverseTarget.id })
    if (err) {
      setToast(err)
    } else {
      setToast(`Jurnal ${reverseTarget.id} dibalik`)
      setDetail(null)
    }
    setReverseTarget(null)
  }

  function handleRetry(sourceKey: string) {
    const err = retryFailedPost(sourceKey)
    setToast(err ?? `Retry ${sourceKey} berhasil`)
  }

  const lineTotals = detail
    ? detail.lines.reduce(
        (acc, l) => ({
          debit: acc.debit + l.debit,
          credit: acc.credit + l.credit,
        }),
        { debit: 0, credit: 0 },
      )
    : null

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Jurnal umum</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Daftar jurnal GL, posting manual, saldo awal, dan retry gagal
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
          searchPlaceholder="Cari ID, memo, sourceKey…"
          filter={sourceFilter}
          filterOptions={SOURCE_FILTERS}
          onFilterChange={(v) => {
            setSourceFilter(v)
            setPage(1)
          }}
          filterLabel="Filter sumber"
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
          secondaryActionLabel="Saldo awal"
          onSecondaryAction={openOpening}
          actionLabel="+ Jurnal manual"
          onAction={openManual}
        />

        <FinanceTable minWidth="880px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Tanggal"
              sortKey="date"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="ID jurnal"
              sortKey="id"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Memo"
              sortKey="memo"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh>Source key</FinanceTh>
            <FinanceSortTh
              label="Sumber"
              sortKey="sourceType"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh>Status</FinanceTh>
            <FinanceTh align="center" className="w-16">
              Detail
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Belum ada jurnal yang cocok." />
            ) : (
              rows.map((row, index) => {
                const st = journalStatus(row)
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {formatJournalDate(row.date)}
                    </FinanceTd>
                    <FinanceTd mono className="font-medium">
                      {row.id}
                    </FinanceTd>
                    <FinanceTd className="max-w-[200px] truncate">
                      {row.memo}
                    </FinanceTd>
                    <FinanceTd mono muted className="max-w-[140px] truncate">
                      {row.sourceKey ?? '—'}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={SOURCE_LABEL[row.sourceType]}
                        tone={SOURCE_TONE[row.sourceType]}
                      />
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill label={st.label} tone={st.tone} />
                    </FinanceTd>
                    <FinanceTd align="center">
                      <button
                        type="button"
                        onClick={() => setDetail(row)}
                        className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                        aria-label={`Detail ${row.id}`}
                        title="Detail"
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

      {failedPosts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
          <h3 className="text-[13px] font-semibold text-ink">
            Posting jurnal gagal ({failedPosts.length})
          </h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Operasi modul sudah jalan; retry hanya mengulang posting GL.
          </p>
          <div className="mt-3">
          <FinanceTable minWidth="640px">
            <FinanceThead>
              <FinanceTh>Source key</FinanceTh>
              <FinanceTh>Memo</FinanceTh>
              <FinanceTh>Error</FinanceTh>
              <FinanceTh align="center" className="w-24">
                Aksi
              </FinanceTh>
            </FinanceThead>
            <tbody>
              {failedPosts.map((f) => (
                <FinanceTr key={f.sourceKey}>
                  <FinanceTd mono className="font-medium">
                    {f.sourceKey}
                  </FinanceTd>
                  <FinanceTd className="max-w-[180px] truncate">
                    {f.payload.memo}
                  </FinanceTd>
                  <FinanceTd className="text-red-800">{f.error}</FinanceTd>
                  <FinanceTd align="center">
                    <button
                      type="button"
                      onClick={() => handleRetry(f.sourceKey)}
                      className="rounded-lg bg-brand-800 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-900"
                    >
                      Retry
                    </button>
                  </FinanceTd>
                </FinanceTr>
              ))}
            </tbody>
          </FinanceTable>
          </div>
        </section>
      ) : null}

      {detail ? (
        <DetailDrawer
          open
          onClose={() => setDetail(null)}
          title={detail.id}
          subtitle={formatJournalDate(detail.date)}
          badge={
            <StatusPill
              label={SOURCE_LABEL[detail.sourceType]}
              tone={SOURCE_TONE[detail.sourceType]}
            />
          }
          footer={
            canReverseJournal(detail) ? (
              <button
                type="button"
                onClick={() => setReverseTarget(detail)}
                className="h-11 w-full rounded-xl border border-red-200 bg-red-50 text-[14px] font-semibold text-red-800 transition hover:bg-red-100"
              >
                Balik jurnal
              </button>
            ) : null
          }
        >
          <DrawerSection label="Ringkasan">
            <dl className="grid gap-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Memo</dt>
                <dd className="text-right text-ink">{detail.memo}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Source key</dt>
                <dd className="font-mono text-right text-[12px]">
                  {detail.sourceKey ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Dibuat oleh</dt>
                <dd>{detail.createdBy}</dd>
              </div>
              {detail.reversesId ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Membalik</dt>
                  <dd className="font-mono text-[12px]">{detail.reversesId}</dd>
                </div>
              ) : null}
              {detail.reversedById ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Dibalik oleh</dt>
                  <dd className="font-mono text-[12px]">{detail.reversedById}</dd>
                </div>
              ) : null}
            </dl>
          </DrawerSection>

          <DrawerSection label="Baris jurnal">
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[480px] text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-surface/60 text-left text-muted">
                    <th className="px-2 py-2">Akun</th>
                    <th className="px-2 py-2 text-right">Debit</th>
                    <th className="px-2 py-2 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line, i) => (
                    <tr key={`${line.accountId}-${i}`} className="border-b border-line/60">
                      <td className="px-2 py-2">{accountLabel(accounts, line.accountId)}</td>
                      <td className="px-2 py-2 text-right font-mono">
                        {line.debit > 0 ? formatIdr(line.debit) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {line.credit > 0 ? formatIdr(line.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {lineTotals ? (
                  <tfoot>
                    <tr className="bg-surface/40 font-mono text-[11px]">
                      <td className="px-2 py-2 text-right text-muted">Total</td>
                      <td className="px-2 py-2 text-right">
                        {formatIdr(lineTotals.debit)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {formatIdr(lineTotals.credit)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </DrawerSection>
        </DetailDrawer>
      ) : null}

      {manualOpen ? (
        <FinanceModal
          title="Jurnal manual"
          subtitle="Debit dan kredit harus balance"
          wide
          onClose={() => setManualOpen(false)}
          footer={
            <ModalActions
              onCancel={() => setManualOpen(false)}
              onConfirm={submitManual}
              confirmLabel="Posting jurnal"
            />
          }
        >
          <div className="space-y-3">
            <TextField
              id="manual-date"
              label="Tanggal jurnal"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              requiredMark
            />
            <TextField
              id="manual-memo"
              label="Memo"
              placeholder="Keterangan jurnal"
              value={manualMemo}
              onChange={(e) => setManualMemo(e.target.value)}
            />
            <JournalLineEditor
              drafts={lineDrafts}
              onChange={setLineDrafts}
              accounts={accounts}
              showBalanceError={formError}
            />
          </div>
        </FinanceModal>
      ) : null}

      {openingOpen ? (
        <FinanceModal
          title="Saldo awal"
          subtitle="Memo: Saldo awal · selisih otomatis ke akun openingEquity"
          wide
          onClose={() => setOpeningOpen(false)}
          footer={
            <ModalActions
              onCancel={() => setOpeningOpen(false)}
              onConfirm={submitOpening}
              confirmLabel="Posting saldo awal"
            />
          }
        >
          <div className="space-y-3">
            <TextField
              id="opening-date"
              label="Tanggal saldo awal"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              requiredMark
            />
            <JournalLineEditor
              drafts={lineDrafts}
              onChange={setLineDrafts}
              accounts={accounts}
              balanceHint={`Selisih debit/kredit akan diposting ke ${accountLabel(accounts, accountMap.openingEquity)}.`}
              showBalanceError={formError}
            />
          </div>
        </FinanceModal>
      ) : null}

      {reverseTarget ? (
        <ConfirmDialog
          open
          title="Balik jurnal?"
          description={`Jurnal ${reverseTarget.id} akan dibuatkan entry pembalikan (debit/kredit ditukar). Operasi modul terkait tidak otomatis di-void.`}
          confirmLabel="Balik jurnal"
          danger
          onConfirm={confirmReverse}
          onClose={() => setReverseTarget(null)}
        />
      ) : null}
    </div>
  )
}
