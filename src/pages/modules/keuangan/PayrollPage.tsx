import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  proofLabel,
  proofToReceipt,
  receiptToProof,
} from '@/components/pembelian/proof-ui'
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
  sortBy,
  toggleSort,
  type SortState,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import {
  ReceiptUpload,
  type ReceiptValue,
} from '@/components/keuangan/ReceiptUpload'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import { parseIdrInput } from '@/features/keuangan/keuangan-data'
import { useMasterStore } from '@/features/master/master-store'
import {
  PAYROLL_STATUS_LABEL,
  ROLE_BASE_SALARY,
  formatIdr,
  lineNet,
  runTotal,
  type PayrollLine,
  type PayrollRun,
  type PayrollStatus,
} from '@/features/payroll/payroll-data'
import { usePayrollStore } from '@/features/payroll/payroll-store'
import { usePageSize } from '@/features/settings/usePageSize'
import { hasApproval } from '@/features/workflow/approvals'

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'menunggu_approve', label: 'Menunggu approve' },
  { value: 'siap_cair', label: 'Siap cair' },
  { value: 'posted', label: 'Posted' },
  { value: 'void', label: 'Void' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

type PayrollSortKey = 'id' | 'period' | 'total' | 'status' | 'actor'

const STATUS_TONE: Record<
  PayrollStatus,
  'neutral' | 'good' | 'warn' | 'muted'
> = {
  draft: 'warn',
  menunggu_approve: 'warn',
  siap_cair: 'neutral',
  posted: 'good',
  void: 'muted',
}

export function PayrollPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    runs,
    createRun,
    updateDraft,
    submitForApproval,
    approveAsAdmin,
    approveAsKeuangan,
    postRun,
    voidRun,
    deleteRun,
  } = usePayrollStore()
  const { users } = useMasterStore()
  const [toast, setToast] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(
    () => searchParams.get('dok'),
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortState<PayrollSortKey> | null>({
    key: 'id',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    const dok = searchParams.get('dok')
    if (dok) setDetailId(dok)
  }, [searchParams])

  function openDetail(id: string) {
    setDetailId(id)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('dok', id)
      return next
    })
  }

  function closeDetail() {
    setDetailId(null)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('dok')
      return next
    })
  }

  const detail = useMemo(
    () => (detailId ? (runs.find((r) => r.id === detailId) ?? null) : null),
    [detailId, runs],
  )

  const stats = useMemo(() => {
    const posted = runs.filter((r) => r.status === 'posted')
    const draft = runs.filter((r) => r.status === 'draft')
    const pending = runs.filter((r) => r.status === 'menunggu_approve')
    const totalPosted = posted.reduce((s, r) => s + runTotal(r), 0)
    return [
      {
        label: 'Run gaji',
        value: String(runs.length),
        delta: `${draft.length} draft · ${pending.length} approve`,
        positive: true,
        spark: [1, 1, 2, 2, 2, 3, 3],
      },
      {
        label: 'Posted',
        value: String(posted.length),
        delta: 'ke kas keluar',
        positive: true,
        spark: [1, 1, 1, 2, 2, 2, 2],
      },
      {
        label: 'Total posted',
        value: formatIdr(totalPosted),
        delta: 'periode aktif',
        positive: true,
        spark: [4, 4, 5, 5, 6, 6, 7],
      },
    ]
  }, [runs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = runs.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!q) return true
      return (
        row.id.toLowerCase().includes(q) ||
        row.period.includes(q) ||
        row.note.toLowerCase().includes(q) ||
        row.actor.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      id: (r) => r.id,
      period: (r) => r.period,
      total: (r) => runTotal(r),
      status: (r) => r.status,
      actor: (r) => r.actor,
    })
  }, [runs, search, statusFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: PayrollSortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function handleCreate() {
    const lines: PayrollLine[] = users
      .filter((u) => u.active)
      .map((u) => ({
        userId: u.id,
        name: u.name,
        role: u.role,
        base: ROLE_BASE_SALARY[u.role] ?? 4_000_000,
        allowance: 200_000,
        deduction: 100_000,
        note: '',
      }))
    if (lines.length === 0) {
      setToast('Tidak ada pengguna aktif')
      return
    }
    const id = createRun(period, lines, `Payroll ${period}`)
    setToast(`Draft ${id} dibuat — sesuaikan gaji lalu ajukan approve`)
    openDetail(id)
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />
      <FinanceToast message={toast} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Payroll</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Dual approve admin + keuangan, bukti transfer wajib saat cair
            </p>
          </div>
          <label className="text-[12px] text-muted">
            Periode draft baru
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 block h-10 rounded-xl border border-line bg-panel px-3 text-[13px] text-ink"
            />
          </label>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari ID, periode, catatan, actor…"
          filter="all"
          filterOptions={[{ value: 'all', label: 'Semua' }]}
          onFilterChange={() => {}}
          secondaryFilter={statusFilter}
          secondaryFilterOptions={STATUS_FILTERS}
          onSecondaryFilterChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          secondaryFilterLabel="Status"
          actionLabel="+ Draft gaji"
          onAction={handleCreate}
        />

        <FinanceTable minWidth="720px">
          <FinanceThead>
            <FinanceSortTh
              label="ID"
              sortKey="id"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Periode"
              sortKey="period"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Total"
              sortKey="total"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Actor"
              sortKey="actor"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={6} message="Belum ada payroll." />
            ) : (
              rows.map((row) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono className="font-medium">
                    {row.id}
                  </FinanceTd>
                  <FinanceTd>{row.period}</FinanceTd>
                  <FinanceTd mono>{formatIdr(runTotal(row))}</FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={PAYROLL_STATUS_LABEL[row.status]}
                      tone={STATUS_TONE[row.status]}
                    />
                  </FinanceTd>
                  <FinanceTd>{row.actor}</FinanceTd>
                  <FinanceTd align="center">
                    <button
                      type="button"
                      onClick={() => openDetail(row.id)}
                      className="text-[12.5px] font-medium text-brand-800 hover:underline"
                    >
                      {row.status === 'draft' ? 'Edit' : 'Detail'}
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
          onPageChange={setPage}
        />
      </section>

      {detail ? (
        <PayrollDetailDrawer
          run={detail}
          userRole={user?.role}
          onClose={closeDetail}
          onUpdateLines={(lines) => updateDraft(detail.id, { lines })}
          onUpdateNote={(note) => updateDraft(detail.id, { note })}
          onUpdateMutationNote={(mutationNote) =>
            updateDraft(detail.id, { mutationNote })
          }
          onSubmit={() => {
            const err = submitForApproval(detail.id)
            if (err) setToast(err)
            else setToast('Payroll diajukan — menunggu approve admin & keuangan')
          }}
          onApproveAdmin={() => {
            const err = approveAsAdmin(detail.id)
            if (err) setToast(err)
            else setToast('Approve admin tercatat')
          }}
          onApproveKeuangan={() => {
            const err = approveAsKeuangan(detail.id)
            if (err) setToast(err)
            else setToast('Approve keuangan tercatat')
          }}
          onPost={(proof) => {
            const err = postRun(detail.id, proof)
            if (err) setToast(err)
            else {
              setToast('Payroll dicairkan ke kas')
              closeDetail()
            }
          }}
          onDelete={() => {
            deleteRun(detail.id)
            closeDetail()
            setToast('Draft dihapus')
          }}
          onVoid={() => {
            voidRun(detail.id)
            setToast('Payroll di-void')
            closeDetail()
          }}
        />
      ) : null}
    </div>
  )
}

function PayrollDetailDrawer({
  run,
  userRole,
  onClose,
  onUpdateLines,
  onUpdateNote,
  onUpdateMutationNote,
  onSubmit,
  onApproveAdmin,
  onApproveKeuangan,
  onPost,
  onDelete,
  onVoid,
}: {
  run: PayrollRun
  userRole?: string
  onClose: () => void
  onUpdateLines: (lines: PayrollLine[]) => void
  onUpdateNote: (note: string) => void
  onUpdateMutationNote: (note: string) => void
  onSubmit: () => void
  onApproveAdmin: () => void
  onApproveKeuangan: () => void
  onPost: (proof: NonNullable<ReturnType<typeof receiptToProof>>) => void
  onDelete: () => void
  onVoid: () => void
}) {
  const locked = run.status === 'posted' || run.status === 'void'
  const lineEditable =
    run.status === 'draft' ||
    run.status === 'menunggu_approve' ||
    run.status === 'siap_cair'
  const needsEditConfirm =
    run.status === 'menunggu_approve' || run.status === 'siap_cair'

  const [editUserId, setEditUserId] = useState<string | null>(
    () => run.lines[0]?.userId ?? null,
  )
  const [confirmEdit, setConfirmEdit] = useState<{
    lines: PayrollLine[]
  } | null>(null)
  const [receipt, setReceipt] = useState<ReceiptValue>(() =>
    proofToReceipt(run.transferProof),
  )
  const [receiptError, setReceiptError] = useState<string | undefined>()

  useEffect(() => {
    if (!editUserId || !run.lines.some((l) => l.userId === editUserId)) {
      setEditUserId(run.lines[0]?.userId ?? null)
    }
  }, [run.lines, editUserId])

  const activeLine = run.lines.find((l) => l.userId === editUserId) ?? null

  const canApproveAdmin =
    userRole === 'admin' &&
    run.status === 'menunggu_approve' &&
    !hasApproval(run.approvals, 'admin')
  const canApproveKeuangan =
    userRole === 'keuangan' &&
    run.status === 'menunggu_approve' &&
    !hasApproval(run.approvals, 'keuangan')
  const canCairFinance =
    run.status === 'siap_cair' &&
    (userRole === 'keuangan' || userRole === 'admin')

  function applyLines(lines: PayrollLine[]) {
    if (needsEditConfirm) setConfirmEdit({ lines })
    else onUpdateLines(lines)
  }

  function patchLine(userId: string, patch: Partial<PayrollLine>) {
    applyLines(
      run.lines.map((line) =>
        line.userId === userId ? { ...line, ...patch } : line,
      ),
    )
  }

  function handleCairkan() {
    const proof = receiptToProof(receipt)
    if (!proof) {
      setReceiptError('Lampirkan bukti transfer sebelum cairkan')
      return
    }
    setReceiptError(undefined)
    onPost(proof)
  }

  return (
    <>
      <DetailDrawer
        open
        onClose={onClose}
        title={run.id}
        subtitle={`Periode ${run.period}${
          run.status === 'draft' ? ' · sesuaikan draft' : ''
        }`}
        badge={
          <StatusPill
            label={PAYROLL_STATUS_LABEL[run.status]}
            tone={
              run.status === 'posted'
                ? 'good'
                : run.status === 'void'
                  ? 'muted'
                  : 'warn'
            }
          />
        }
        footer={
          <>
            {run.status === 'draft' ? (
              <>
                <button
                  type="button"
                  onClick={onSubmit}
                  className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white hover:bg-brand-900"
                >
                  Ajukan approve
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 hover:bg-red-50"
                >
                  Hapus draft
                </button>
              </>
            ) : null}
            {canApproveAdmin ? (
              <button
                type="button"
                onClick={onApproveAdmin}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white hover:bg-brand-900"
              >
                Approve sebagai Admin
              </button>
            ) : null}
            {canApproveKeuangan ? (
              <button
                type="button"
                onClick={onApproveKeuangan}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white hover:bg-brand-900"
              >
                Approve sebagai Keuangan
              </button>
            ) : null}
            {canCairFinance ? (
              <button
                type="button"
                onClick={handleCairkan}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white hover:bg-brand-900"
              >
                Cairkan ke kas
              </button>
            ) : null}
            {run.status === 'posted' ? (
              <button
                type="button"
                onClick={onVoid}
                className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 hover:bg-red-50"
              >
                Void
              </button>
            ) : null}
            {(run.status === 'menunggu_approve' ||
              run.status === 'siap_cair') &&
            (userRole === 'admin' || userRole === 'keuangan') ? (
              <button
                type="button"
                onClick={onVoid}
                className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 hover:bg-red-50"
              >
                Void run
              </button>
            ) : null}
          </>
        }
      >
        <DrawerHero
          label="Total bersih"
          amount={formatIdr(runTotal(run))}
          hint={`${run.lines.length} karyawan`}
        />

        {run.approvals.length > 0 ? (
          <DrawerSection label="Persetujuan">
            <DrawerFacts
              items={run.approvals.map((a) => [
                a.role === 'admin' ? 'Admin' : 'Keuangan',
                `${a.by} · ${new Date(a.at).toLocaleString('id-ID')}`,
              ])}
            />
          </DrawerSection>
        ) : null}

        <DrawerSection label="Karyawan">
          <div className="flex flex-wrap gap-1.5">
            {run.lines.map((line) => {
              const selected = line.userId === editUserId
              return (
                <button
                  key={line.userId}
                  type="button"
                  onClick={() => setEditUserId(line.userId)}
                  className={[
                    'rounded-xl border px-2.5 py-1.5 text-[12px] font-medium transition',
                    selected
                      ? 'border-brand-700 bg-brand-800 text-white'
                      : 'border-line bg-panel text-ink hover:bg-surface',
                  ].join(' ')}
                >
                  {line.name}
                </button>
              )
            })}
          </div>
        </DrawerSection>

        {activeLine ? (
          <DrawerSection
            label={lineEditable && !locked ? 'Sesuaikan gaji' : 'Rincian gaji'}
          >
            {lineEditable && !locked ? (
              <div className="space-y-3">
                <p className="text-[12.5px] text-muted">
                  {activeLine.name} · {activeLine.role}
                  {needsEditConfirm
                    ? ' · ubah baris akan reset approve'
                    : ''}
                </p>
                <TextField
                  id={`pay-base-${activeLine.userId}`}
                  label="Gaji pokok (IDR)"
                  inputMode="numeric"
                  value={String(activeLine.base || '')}
                  onChange={(e) =>
                    patchLine(activeLine.userId, {
                      base: parseIdrInput(e.target.value),
                    })
                  }
                />
                <TextField
                  id={`pay-allow-${activeLine.userId}`}
                  label="Tunjangan (IDR)"
                  inputMode="numeric"
                  value={String(activeLine.allowance || '')}
                  onChange={(e) =>
                    patchLine(activeLine.userId, {
                      allowance: parseIdrInput(e.target.value),
                    })
                  }
                />
                <TextField
                  id={`pay-deduct-${activeLine.userId}`}
                  label="Potongan (IDR)"
                  inputMode="numeric"
                  value={String(activeLine.deduction || '')}
                  onChange={(e) =>
                    patchLine(activeLine.userId, {
                      deduction: parseIdrInput(e.target.value),
                    })
                  }
                />
                <TextField
                  id={`pay-note-${activeLine.userId}`}
                  label="Catatan baris"
                  value={activeLine.note}
                  placeholder="Opsional"
                  onChange={(e) =>
                    patchLine(activeLine.userId, { note: e.target.value })
                  }
                />
                <div className="rounded-xl border border-line bg-surface/80 px-3.5 py-2.5">
                  <p className="text-[11px] tracking-wide text-muted uppercase">
                    Bersih
                  </p>
                  <p className="mt-0.5 font-mono text-[15px] font-semibold text-ink">
                    {formatIdr(lineNet(activeLine))}
                  </p>
                </div>
              </div>
            ) : (
              <DrawerFacts
                items={[
                  ['Nama', activeLine.name],
                  ['Peran', activeLine.role],
                  ['Pokok', formatIdr(activeLine.base)],
                  ['Tunjangan', formatIdr(activeLine.allowance)],
                  ['Potongan', formatIdr(activeLine.deduction)],
                  ['Bersih', formatIdr(lineNet(activeLine))],
                  ['Catatan', activeLine.note || '—'],
                ]}
              />
            )}
          </DrawerSection>
        ) : null}

        {canCair ? (
          <DrawerSection label="Bukti transfer">
            <ReceiptUpload
              value={receipt}
              onChange={(v) => {
                setReceipt(v)
                setReceiptError(undefined)
              }}
              label="Bukti transfer gaji"
              hint="Wajib sebelum cairkan · JPG, PNG, WEBP, atau PDF"
              error={receiptError}
              requiredMark
            />
            <TextField
              id="pay-mutation-note"
              label="Catatan mutasi (opsional)"
              value={run.mutationNote ?? ''}
              placeholder="Referensi transfer bank"
              onChange={(e) => onUpdateMutationNote(e.target.value)}
            />
          </DrawerSection>
        ) : null}

        {locked && proofLabel(run.transferProof) ? (
          <DrawerSection label="Bukti transfer">
            <DrawerFacts items={[['File', proofLabel(run.transferProof)!]]} />
          </DrawerSection>
        ) : null}

        <DrawerSection label="Meta run">
          {run.status === 'draft' ? (
            <TextField
              id="pay-run-note"
              label="Catatan run"
              value={run.note}
              placeholder="Mis. Gaji Oktober"
              onChange={(e) => onUpdateNote(e.target.value)}
            />
          ) : (
            <DrawerFacts
              items={[
                ['Catatan', run.note || '—'],
                ['Dibuat', new Date(run.createdAt).toLocaleString('id-ID')],
                [
                  'Posted',
                  run.postedAt
                    ? new Date(run.postedAt).toLocaleString('id-ID')
                    : '—',
                ],
                ['Catatan mutasi', run.mutationNote || '—'],
              ]}
            />
          )}
        </DrawerSection>
      </DetailDrawer>

      <ConfirmDialog
        open={confirmEdit !== null}
        title="Ubah baris gaji?"
        description="Perubahan material akan menghapus semua approve dan mengembalikan run ke draft."
        confirmLabel="Ya, ubah"
        danger
        onClose={() => setConfirmEdit(null)}
        onConfirm={() => {
          if (confirmEdit) onUpdateLines(confirmEdit.lines)
          setConfirmEdit(null)
        }}
      />
    </>
  )
}
