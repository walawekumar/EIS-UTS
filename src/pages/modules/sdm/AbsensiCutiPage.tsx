import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { PageSection } from '@/components/ui/PageSection'
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
import {
  FinanceModal,
  ModalActions,
} from '@/components/keuangan/FinanceModal'
import {
  ReceiptUpload,
  type ReceiptValue,
} from '@/components/keuangan/ReceiptUpload'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { todayIsoDate } from '@/features/absensi/absensi-data'
import {
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  countWorkdays,
  proofDisplayName,
  proofPreviewUrl,
  type LeaveStatus,
  type LeaveType,
} from '@/features/hr/leave-data'
import { useLeaveStore } from '@/features/hr/leave-store'
import { useAuth } from '@/features/auth/AuthContext'
import { usePageSize } from '@/features/settings/usePageSize'
import type { ProofAttachment } from '@/features/workflow/proof'

type CutiSortKey = 'type' | 'start' | 'days' | 'status'

const TYPE_OPTIONS = (Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map(
  (value) => ({ value, label: LEAVE_TYPE_LABEL[value] }),
)

function receiptToProof(receipt: ReceiptValue): ProofAttachment | undefined {
  if (!receipt) return undefined
  return {
    name: receipt.name,
    size: receipt.size,
    mime: receipt.mime,
    previewUrl: receipt.url ?? receipt.previewUrl,
  }
}

export function AbsensiCutiPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const {
    requests,
    ready,
    persistError,
    cutiUsed,
    cutiQuota,
    submitLeave,
    cancelLeave,
  } = useLeaveStore()
  const [toast, setToast] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<LeaveType>('cuti')
  const [startDate, setStartDate] = useState(todayIsoDate)
  const [endDate, setEndDate] = useState(todayIsoDate)
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState<ReceiptValue>(null)
  const [proofError, setProofError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all')
  const [sort, setSort] = useState<SortState<CutiSortKey> | null>({
    key: 'start',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = requests
      .filter((r) => r.userId === user?.id)
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => {
        if (!q) return true
        return (
          LEAVE_TYPE_LABEL[r.leaveType].toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          r.startDate.includes(q) ||
          r.endDate.includes(q)
        )
      })
    return sortBy(base, sort, {
      type: (r) => r.leaveType,
      start: (r) => r.startDate,
      days: (r) => r.days,
      status: (r) => r.status,
    })
  }, [requests, user?.id, statusFilter, sort, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const mine = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  const days = countWorkdays(startDate, endDate)

  function resetForm() {
    setLeaveType('cuti')
    setStartDate(todayIsoDate())
    setEndDate(todayIsoDate())
    setReason('')
    setReceipt(null)
    setProofError(undefined)
  }

  function closeModal() {
    if (busy) return
    setOpen(false)
    resetForm()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const proof = receiptToProof(receipt)
    if (!proof) {
      setProofError('Lampirkan bukti pendukung.')
      return
    }
    setProofError(undefined)
    setBusy(true)
    const err = await submitLeave({
      leaveType,
      startDate,
      endDate,
      reason,
      proof,
    })
    setBusy(false)
    if (err) {
      setToast(err)
      return
    }
    setToast('Pengajuan terkirim — menunggu approve HR')
    setOpen(false)
    resetForm()
  }

  if (!ready) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-line bg-panel">
        <span
          className="size-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-800"
          aria-hidden
        />
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <PageSection
        title="Cuti & izin"
        subtitle={`Kuota cuti ${cutiUsed}/${cutiQuota} hari · alasan dan bukti wajib · disetujui HR`}
        actions={<FinanceToast message={toast} />}
      >
        {persistError ? (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            {persistError}
          </p>
        ) : null}

        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari jenis, alasan, tanggal…"
          filter={statusFilter}
          filterLabel="Status"
          filterOptions={[
            { value: 'all', label: 'Semua status' },
            { value: 'pending', label: 'Menunggu' },
            { value: 'approved', label: 'Disetujui' },
            { value: 'rejected', label: 'Ditolak' },
            { value: 'cancelled', label: 'Dibatalkan' },
          ]}
          onFilterChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          actionLabel="+ Ajukan"
          onAction={() => setOpen(true)}
        />

        <FinanceTable minWidth="780px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Jenis"
              sortKey="type"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Tanggal"
              sortKey="start"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Hari"
              sortKey="days"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceTh>Bukti</FinanceTh>
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceTh align="center" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {mine.length === 0 ? (
              <FinanceEmptyRow
                colSpan={7}
                message="Belum ada pengajuan. Tekan Ajukan untuk membuat."
                actionLabel="+ Ajukan"
                onAction={() => setOpen(true)}
              />
            ) : (
              mine.map((row, index) => {
                const url = proofPreviewUrl(row.proof)
                return (
                  <FinanceTr key={row.id}>
                    <FinanceTd mono muted>
                      {rowNumber(safePage, PAGE_SIZE, index)}
                    </FinanceTd>
                    <FinanceTd className="font-medium">
                      {LEAVE_TYPE_LABEL[row.leaveType]}
                      <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                        {row.reason}
                      </span>
                    </FinanceTd>
                    <FinanceTd mono muted>
                      {row.startDate}
                      {row.endDate !== row.startDate
                        ? ` → ${row.endDate}`
                        : ''}
                    </FinanceTd>
                    <FinanceTd mono>{row.days}</FinanceTd>
                    <FinanceTd>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] font-medium text-brand-800 hover:underline"
                        >
                          Lihat
                        </a>
                      ) : (
                        <span className="text-[12px] text-muted">
                          {proofDisplayName(row.proof)}
                        </span>
                      )}
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={LEAVE_STATUS_LABEL[row.status]}
                        tone={
                          row.status === 'approved'
                            ? 'good'
                            : row.status === 'pending'
                              ? 'warn'
                              : 'muted'
                        }
                      />
                    </FinanceTd>
                    <FinanceTd align="center">
                      {row.status === 'pending' ? (
                        <button
                          type="button"
                          className="text-[12px] font-medium text-red-700 hover:underline"
                          onClick={() => {
                            void cancelLeave(row.id).then((err) =>
                              setToast(err ?? 'Dibatalkan'),
                            )
                          }}
                        >
                          Batalkan
                        </button>
                      ) : (
                        <span className="text-[12px] text-muted">—</span>
                      )}
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
      </PageSection>

      {open ? (
        <FinanceModal
          title="Ajukan cuti / izin"
          subtitle="Form pengajuan"
          onClose={closeModal}
          wide
          footer={
            <ModalActions
              onCancel={closeModal}
              onConfirm={() => {
                const form = document.getElementById(
                  'cuti-form',
                ) as HTMLFormElement | null
                form?.requestSubmit()
              }}
              confirmLabel={busy ? 'Mengirim…' : 'Kirim pengajuan'}
              confirmDisabled={busy}
            />
          }
        >
          <form id="cuti-form" className="grid gap-3" onSubmit={onSubmit}>
            <Select
              id="leave-type"
              label="Jenis"
              value={leaveType}
              onChange={setLeaveType}
              options={TYPE_OPTIONS}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                id="leave-start"
                label="Mulai"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <TextField
                id="leave-end"
                label="Selesai"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <p className="text-[12px] text-muted">{days} hari kerja</p>
            <TextField
              id="leave-reason"
              label="Alasan"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Wajib, jelaskan keperluan…"
              requiredMark
            />
            <ReceiptUpload
              label="Bukti pendukung"
              hint="Wajib · surat dokter / surat izin / dokumen · JPG/PNG/PDF · maks. 3 MB"
              value={receipt}
              onChange={setReceipt}
              error={proofError}
              requiredMark
            />
          </form>
        </FinanceModal>
      ) : null}
    </div>
  )
}
