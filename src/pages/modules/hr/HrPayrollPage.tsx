import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
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
import { PromptDialog } from '@/components/ui/ConfirmDialog'
import { PageSection } from '@/components/ui/PageSection'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import { useMasterStore } from '@/features/master/master-store'
import {
  PAYROLL_STATUS_LABEL,
  ROLE_BASE_SALARY,
  formatIdr,
  runTotal,
  type PayrollLine,
  type PayrollRun,
  type PayrollStatus,
} from '@/features/payroll/payroll-data'
import { usePayrollStore } from '@/features/payroll/payroll-store'
import { usePageSize } from '@/features/settings/usePageSize'

type StatusFilter = 'all' | PayrollStatus
type PayrollSortKey = 'id' | 'period' | 'total' | 'status'

function toneFor(status: PayrollStatus) {
  if (status === 'posted') return 'good' as const
  if (status === 'void') return 'muted' as const
  return 'warn' as const
}

export function HrPayrollPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const { users } = useMasterStore()
  const {
    runs,
    createRun,
    submitForApproval,
    approveAsHr,
    approveAsAdmin,
    rejectRun,
  } = usePayrollStore()
  const navigate = useNavigate()
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortState<PayrollSortKey> | null>({
    key: 'period',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectError, setRejectError] = useState<string | undefined>()

  const queue = useMemo(() => {
    if (!user) return [] as PayrollRun[]
    if (user.role === 'hr') {
      return runs.filter((r) => r.status === 'menunggu_hr')
    }
    if (user.role === 'admin') {
      return runs.filter((r) => r.status === 'menunggu_admin')
    }
    return []
  }, [runs, user])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = runs
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter(
        (r) =>
          !q ||
          r.id.toLowerCase().includes(q) ||
          r.period.toLowerCase().includes(q),
      )
    return sortBy(base, sort, {
      id: (r) => r.id,
      period: (r) => r.period,
      total: (r) => runTotal(r),
      status: (r) => r.status,
    })
  }, [runs, search, statusFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const list = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  if (!user) return null
  if (user.role !== 'admin' && user.role !== 'hr') {
    return <Navigate to="/absensi" replace />
  }

  function seedLines(): PayrollLine[] {
    return users
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
  }

  function onCreate() {
    if (user?.role !== 'hr' && user?.role !== 'admin') {
      setToast('Hanya HR yang menyiapkan draft gaji')
      return
    }
    const id = createRun(period, seedLines(), '')
    setToast(`Draft ${id} dibuat`)
    navigate(`/app/keuangan/payroll?dok=${encodeURIComponent(id)}`)
  }

  return (
    <div className="space-y-2.5">
      {queue.length > 0 ? (
        <PageSection
          title="Menunggu approve Anda"
          subtitle={
            user.role === 'hr'
              ? 'Stamp HR sebelum diteruskan ke admin'
              : 'Stamp admin sebelum diteruskan ke keuangan'
          }
          actions={<FinanceToast message={toast} />}
        >
          <FinanceTable minWidth="780px">
            <FinanceThead>
              <FinanceTh className="w-12">No</FinanceTh>
              <FinanceTh>ID</FinanceTh>
              <FinanceTh>Periode</FinanceTh>
              <FinanceTh>Total</FinanceTh>
              <FinanceTh>Status</FinanceTh>
              <FinanceTh align="center" className="w-40">
                Aksi
              </FinanceTh>
            </FinanceThead>
            <tbody>
              {queue.map((run, index) => (
                <FinanceTr key={run.id}>
                  <FinanceTd mono muted>
                    {index + 1}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {run.id}
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {run.period}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium whitespace-nowrap">
                    {formatIdr(runTotal(run))}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={PAYROLL_STATUS_LABEL[run.status]}
                      tone="warn"
                    />
                  </FinanceTd>
                  <FinanceTd align="center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <button
                        type="button"
                        className="text-[12px] font-medium text-brand-800 hover:underline"
                        onClick={() => {
                          const err =
                            user.role === 'hr'
                              ? approveAsHr(run.id)
                              : approveAsAdmin(run.id)
                          setToast(err ?? 'Approve tercatat')
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-[12px] font-medium text-red-700 hover:underline"
                        onClick={() => {
                          setRejectError(undefined)
                          setRejectId(run.id)
                        }}
                      >
                        Tolak
                      </button>
                      <Link
                        to={`/app/keuangan/payroll?dok=${encodeURIComponent(run.id)}`}
                        className="text-[12px] font-medium text-brand-800 hover:underline"
                      >
                        Detail
                      </Link>
                    </div>
                  </FinanceTd>
                </FinanceTr>
              ))}
            </tbody>
          </FinanceTable>
        </PageSection>
      ) : null}

      <PageSection
        title="Persiapan gaji"
        subtitle="Susun draft gaji periode, ajukan ke alur approve, lalu pantau status sampai cair di keuangan"
        actions={
          queue.length === 0 ? <FinanceToast message={toast} /> : null
        }
      >
        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari ID atau periode…"
          filter={statusFilter}
          filterLabel="Status"
          filterOptions={[
            { value: 'all', label: 'Semua status' },
            { value: 'draft', label: 'Draft' },
            { value: 'menunggu_hr', label: 'Menunggu HR' },
            { value: 'menunggu_admin', label: 'Menunggu admin' },
            { value: 'menunggu_keuangan', label: 'Menunggu keuangan' },
            { value: 'siap_cair', label: 'Siap cair' },
            { value: 'posted', label: 'Posted' },
            { value: 'void', label: 'Void' },
          ]}
          onFilterChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          actionLabel="+ Draft gaji"
          onAction={onCreate}
        />

        <div className="mb-3.5 w-40">
          <TextField
            id="hr-payroll-period"
            label="Periode draft"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>

        <FinanceTable minWidth="780px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="ID"
              sortKey="id"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Periode"
              sortKey="period"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Total"
              sortKey="total"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
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
            {list.length === 0 ? (
              <FinanceEmptyRow
                colSpan={6}
                message="Belum ada run payroll."
                actionLabel="+ Draft gaji"
                onAction={onCreate}
              />
            ) : (
              list.map((run, index) => (
                <FinanceTr key={run.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {run.id}
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {run.period}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium whitespace-nowrap">
                    {formatIdr(runTotal(run))}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={PAYROLL_STATUS_LABEL[run.status]}
                      tone={toneFor(run.status)}
                    />
                  </FinanceTd>
                  <FinanceTd align="center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <Link
                        to={`/app/keuangan/payroll?dok=${encodeURIComponent(run.id)}`}
                        className="text-[12px] font-medium text-brand-800 hover:underline"
                      >
                        Buka
                      </Link>
                      {run.status === 'draft' && user.role === 'hr' ? (
                        <button
                          type="button"
                          className="text-[12px] font-medium text-brand-800 hover:underline"
                          onClick={() => {
                            const err = submitForApproval(run.id)
                            setToast(err ?? 'Diajukan ke antrian HR')
                          }}
                        >
                          Ajukan
                        </button>
                      ) : null}
                    </div>
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
      </PageSection>

      <PromptDialog
        open={rejectId != null}
        title="Tolak payroll"
        description="Alasan penolakan wajib dan tercatat di audit."
        label="Alasan"
        placeholder="Jelaskan kenapa ditolak…"
        confirmLabel="Tolak"
        danger
        submitError={rejectError}
        onClose={() => {
          setRejectId(null)
          setRejectError(undefined)
        }}
        onConfirm={(reason) => {
          if (!rejectId) return
          const err = rejectRun(rejectId, reason)
          if (err) {
            setRejectError(err)
            return
          }
          setRejectId(null)
          setRejectError(undefined)
          setToast('Ditolak')
        }}
      />
    </div>
  )
}
