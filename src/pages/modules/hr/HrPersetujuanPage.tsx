import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FinancePager } from '@/components/keuangan/FinancePager'
import {
  ActorCell,
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
import { PageSection } from '@/components/ui/PageSection'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import {
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  proofDisplayName,
  proofPreviewUrl,
  type LeaveRequest,
} from '@/features/hr/leave-data'
import { useLeaveStore } from '@/features/hr/leave-store'
import { usePageSize } from '@/features/settings/usePageSize'

type PendingSortKey = 'name' | 'type' | 'start' | 'days'
type DecidedSortKey = 'name' | 'type' | 'status'

function ProofLink({ row }: { row: LeaveRequest }) {
  const url = proofPreviewUrl(row.proof)
  const name = proofDisplayName(row.proof)
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[12px] font-medium text-brand-800 hover:underline"
      >
        Lihat bukti
      </a>
    )
  }
  return <span className="text-[12px] text-muted">{name}</span>
}

export function HrPersetujuanPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const { requests, ready, approveLeave, rejectLeave, overrideLeave } =
    useLeaveStore()
  const [toast, setToast] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [pendingSort, setPendingSort] =
    useState<SortState<PendingSortKey> | null>({
      key: 'start',
      dir: 'asc',
    })
  const [decidedSort, setDecidedSort] =
    useState<SortState<DecidedSortKey> | null>({
      key: 'name',
      dir: 'asc',
    })
  const [pendingPage, setPendingPage] = useState(1)
  const [decidedPage, setDecidedPage] = useState(1)

  const pendingFiltered = useMemo(() => {
    const base = requests.filter((r) => r.status === 'pending')
    return sortBy(base, pendingSort, {
      name: (r) => r.userName,
      type: (r) => r.leaveType,
      start: (r) => r.startDate,
      days: (r) => r.days,
    })
  }, [requests, pendingSort])

  const decidedFiltered = useMemo(() => {
    const base = requests.filter(
      (r) => r.status === 'approved' || r.status === 'rejected',
    )
    return sortBy(base, decidedSort, {
      name: (r) => r.userName,
      type: (r) => r.leaveType,
      status: (r) => r.status,
    })
  }, [requests, decidedSort])

  const pendingPageCount = Math.max(
    1,
    Math.ceil(pendingFiltered.length / PAGE_SIZE),
  )
  const decidedPageCount = Math.max(
    1,
    Math.ceil(decidedFiltered.length / PAGE_SIZE),
  )
  const safePendingPage = Math.min(pendingPage, pendingPageCount)
  const safeDecidedPage = Math.min(decidedPage, decidedPageCount)
  const pending = pendingFiltered.slice(
    (safePendingPage - 1) * PAGE_SIZE,
    safePendingPage * PAGE_SIZE,
  )
  const decided = decidedFiltered.slice(
    (safeDecidedPage - 1) * PAGE_SIZE,
    safeDecidedPage * PAGE_SIZE,
  )

  if (!user) return null
  if (user.role !== 'admin' && user.role !== 'hr') {
    return <Navigate to="/absensi" replace />
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

  function noteOf(id: string) {
    return notes[id] ?? ''
  }

  return (
    <div className="space-y-2.5">
      <PageSection
        title="Persetujuan cuti / izin"
        subtitle="Cek bukti + isi alasan sebelum setujui/tolak. Admin dapat override keputusan HR"
        actions={<FinanceToast message={toast} />}
      >
        <FinanceTable minWidth="960px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Pegawai"
              sortKey="name"
              sort={pendingSort}
              onSort={(key) =>
                setPendingSort((prev) => toggleSort(prev, key))
              }
            />
            <FinanceSortTh
              label="Jenis"
              sortKey="type"
              sort={pendingSort}
              onSort={(key) =>
                setPendingSort((prev) => toggleSort(prev, key))
              }
            />
            <FinanceSortTh
              label="Tanggal"
              sortKey="start"
              sort={pendingSort}
              onSort={(key) =>
                setPendingSort((prev) => toggleSort(prev, key))
              }
            />
            <FinanceTh>Alasan</FinanceTh>
            <FinanceTh>Bukti</FinanceTh>
            <FinanceTh>Catatan HR/Admin</FinanceTh>
            <FinanceTh align="center" className="w-36">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {pending.length === 0 ? (
              <FinanceEmptyRow
                colSpan={8}
                message="Tidak ada pengajuan pending."
              />
            ) : (
              pending.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePendingPage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd>
                    <ActorCell name={row.userName} />
                  </FinanceTd>
                  <FinanceTd>{LEAVE_TYPE_LABEL[row.leaveType]}</FinanceTd>
                  <FinanceTd mono muted>
                    {row.startDate}
                    {row.endDate !== row.startDate ? ` → ${row.endDate}` : ''}{' '}
                    ({row.days}h)
                  </FinanceTd>
                  <FinanceTd className="max-w-[200px] truncate">
                    {row.reason}
                  </FinanceTd>
                  <FinanceTd>
                    <ProofLink row={row} />
                  </FinanceTd>
                  <FinanceTd>
                    <TextField
                      id={`note-${row.id}`}
                      label="Alasan"
                      value={noteOf(row.id)}
                      onChange={(e) =>
                        setNotes((m) => ({ ...m, [row.id]: e.target.value }))
                      }
                      placeholder="Wajib diisi…"
                      className="min-w-[160px]"
                    />
                  </FinanceTd>
                  <FinanceTd align="center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <button
                        type="button"
                        className="text-[12px] font-medium text-brand-800 hover:underline"
                        onClick={() => {
                          void approveLeave(row.id, noteOf(row.id)).then(
                            (err) => setToast(err ?? 'Disetujui'),
                          )
                        }}
                      >
                        Setujui
                      </button>
                      <button
                        type="button"
                        className="text-[12px] font-medium text-red-700 hover:underline"
                        onClick={() => {
                          void rejectLeave(row.id, noteOf(row.id)).then((err) =>
                            setToast(err ?? 'Ditolak'),
                          )
                        }}
                      >
                        Tolak
                      </button>
                    </div>
                  </FinanceTd>
                </FinanceTr>
              ))
            )}
          </tbody>
        </FinanceTable>

        <FinancePager
          page={safePendingPage}
          pageCount={pendingPageCount}
          total={pendingFiltered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPendingPage}
        />
      </PageSection>

      <PageSection
        title={
          user.role === 'admin'
            ? 'Riwayat diputuskan · override admin'
            : 'Riwayat diputuskan'
        }
      >
        <FinanceTable minWidth="960px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Pegawai"
              sortKey="name"
              sort={decidedSort}
              onSort={(key) =>
                setDecidedSort((prev) => toggleSort(prev, key))
              }
            />
            <FinanceSortTh
              label="Jenis"
              sortKey="type"
              sort={decidedSort}
              onSort={(key) =>
                setDecidedSort((prev) => toggleSort(prev, key))
              }
            />
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={decidedSort}
              onSort={(key) =>
                setDecidedSort((prev) => toggleSort(prev, key))
              }
            />
            <FinanceTh>Bukti</FinanceTh>
            <FinanceTh>Catatan</FinanceTh>
            <FinanceTh>Override</FinanceTh>
          </FinanceThead>
          <tbody>
            {decided.length === 0 ? (
              <FinanceEmptyRow colSpan={7} message="Belum ada keputusan." />
            ) : (
              decided.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safeDecidedPage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd>
                    <ActorCell name={row.userName} />
                  </FinanceTd>
                  <FinanceTd>{LEAVE_TYPE_LABEL[row.leaveType]}</FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={LEAVE_STATUS_LABEL[row.status]}
                      tone={row.status === 'approved' ? 'good' : 'danger'}
                    />
                  </FinanceTd>
                  <FinanceTd>
                    <ProofLink row={row} />
                  </FinanceTd>
                  <FinanceTd>
                    <p className="text-[12px] text-ink">
                      {row.reviewNote ?? '—'}
                    </p>
                    <p className="text-[11px] text-muted">
                      oleh {row.reviewedBy ?? '—'}
                    </p>
                  </FinanceTd>
                  <FinanceTd>
                    {user.role === 'admin' ? (
                      <div className="space-y-2">
                        <TextField
                          id={`ov-${row.id}`}
                          label="Override"
                          value={noteOf(`ov-${row.id}`)}
                          onChange={(e) =>
                            setNotes((m) => ({
                              ...m,
                              [`ov-${row.id}`]: e.target.value,
                            }))
                          }
                          placeholder="Alasan override…"
                          className="min-w-[160px]"
                        />
                        <div className="inline-flex flex-wrap gap-2">
                          {row.status === 'rejected' ? (
                            <button
                              type="button"
                              className="text-[12px] font-medium text-brand-800 hover:underline"
                              onClick={() => {
                                void overrideLeave(
                                  row.id,
                                  'approved',
                                  noteOf(`ov-${row.id}`),
                                ).then((err) =>
                                  setToast(err ?? 'Override: disetujui'),
                                )
                              }}
                            >
                              Override setujui
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-[12px] font-medium text-red-700 hover:underline"
                              onClick={() => {
                                void overrideLeave(
                                  row.id,
                                  'rejected',
                                  noteOf(`ov-${row.id}`),
                                ).then((err) =>
                                  setToast(err ?? 'Override: ditolak'),
                                )
                              }}
                            >
                              Override tolak
                            </button>
                          )}
                        </div>
                        {row.overrideNote ? (
                          <p className="text-[11px] text-amber-800">
                            Override {row.overriddenBy}: {row.overrideNote}
                          </p>
                        ) : null}
                      </div>
                    ) : row.overrideNote ? (
                      <p className="text-[11px] text-amber-800">
                        Override {row.overriddenBy}: {row.overrideNote}
                      </p>
                    ) : (
                      <span className="text-[12px] text-muted">—</span>
                    )}
                  </FinanceTd>
                </FinanceTr>
              ))
            )}
          </tbody>
        </FinanceTable>

        <FinancePager
          page={safeDecidedPage}
          pageCount={decidedPageCount}
          total={decidedFiltered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setDecidedPage}
        />
      </PageSection>
    </div>
  )
}
