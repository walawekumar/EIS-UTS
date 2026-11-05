import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
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
import { StatusPill } from '@/components/keuangan/StatusPill'
import { PageSection } from '@/components/ui/PageSection'
import {
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  type LeaveRequest,
} from '@/features/hr/leave-data'
import {
  PAYROLL_STATUS_LABEL,
  formatIdr,
  runTotal,
  type PayrollRun,
} from '@/features/payroll/payroll-data'
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceRecord,
} from '@/features/absensi/absensi-data'
import { usePageSize } from '@/features/settings/usePageSize'

type QueueKind = 'all' | 'leave' | 'payroll' | 'late'
type QueueSortKey = 'kind' | 'title' | 'when' | 'status'

type QueueRow = {
  id: string
  kind: 'leave' | 'payroll' | 'late'
  kindLabel: string
  title: string
  detail: string
  when: string
  statusLabel: string
  tone: 'warn' | 'good' | 'muted' | 'danger'
  href: string
  useActor: boolean
}

type HrQueueTableProps = {
  leave: LeaveRequest[]
  payroll: PayrollRun[]
  lateToday: AttendanceRecord[]
  payrollHref?: string
}

export function HrQueueTable({
  leave,
  payroll,
  lateToday,
  payrollHref = '/hr/payroll',
}: HrQueueTableProps) {
  const PAGE_SIZE = usePageSize()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<QueueKind>('all')
  const [sort, setSort] = useState<SortState<QueueSortKey> | null>({
    key: 'when',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)

  const filtered = useMemo((): QueueRow[] => {
    const out: QueueRow[] = []

    for (const r of leave.filter((x) => x.status === 'pending')) {
      out.push({
        id: `leave-${r.id}`,
        kind: 'leave',
        kindLabel: 'Cuti / izin',
        title: r.userName,
        detail: `${LEAVE_TYPE_LABEL[r.leaveType]} · ${r.startDate}${
          r.endDate !== r.startDate ? ` → ${r.endDate}` : ''
        } · ${r.days} hari`,
        when: r.createdAt,
        statusLabel: LEAVE_STATUS_LABEL[r.status],
        tone: 'warn',
        href: '/hr/persetujuan',
        useActor: true,
      })
    }

    for (const r of payroll) {
      out.push({
        id: `pay-${r.id}`,
        kind: 'payroll',
        kindLabel: 'Payroll',
        title: r.id,
        detail: `Periode ${r.period} · ${formatIdr(runTotal(r))}`,
        when: r.createdAt,
        statusLabel: PAYROLL_STATUS_LABEL[r.status],
        tone: 'warn',
        href: payrollHref,
        useActor: false,
      })
    }

    for (const r of lateToday) {
      out.push({
        id: `late-${r.id}`,
        kind: 'late',
        kindLabel: 'Kehadiran',
        title: r.userName,
        detail: `Terlambat · ${r.date}`,
        when: r.checkIn ?? r.date,
        statusLabel: ATTENDANCE_STATUS_LABEL[r.status],
        tone: 'muted',
        href: '/hr/rekap',
        useActor: true,
      })
    }

    const q = search.trim().toLowerCase()
    const base = out.filter((row) => {
      if (filter !== 'all' && row.kind !== filter) return false
      if (!q) return true
      return (
        row.title.toLowerCase().includes(q) ||
        row.detail.toLowerCase().includes(q) ||
        row.kindLabel.toLowerCase().includes(q)
      )
    })

    return sortBy(base, sort, {
      kind: (row) => row.kindLabel,
      title: (row) => row.title,
      when: (row) => row.when,
      status: (row) => row.statusLabel,
    })
  }, [leave, payroll, lateToday, search, filter, sort, payrollHref])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  return (
    <PageSection
      title="Antrian kerja"
      subtitle="Cuti, payroll, dan keterlambatan yang perlu ditindak"
      actions={
        <p className="text-[12px] text-muted tabular-nums">
          {filtered.length} item
        </p>
      }
    >
      <FinanceFilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Nama, ID, detail…"
        filter={filter}
        filterLabel="Jenis"
        filterOptions={[
          { value: 'all', label: 'Semua jenis' },
          { value: 'leave', label: 'Cuti / izin' },
          { value: 'payroll', label: 'Payroll' },
          { value: 'late', label: 'Keterlambatan' },
        ]}
        onFilterChange={(v) => {
          setFilter(v)
          setPage(1)
        }}
      />

      <FinanceTable minWidth="720px">
        <FinanceThead>
          <FinanceTh className="w-12">No</FinanceTh>
          <FinanceSortTh
            label="Jenis"
            sortKey="kind"
            sort={sort}
            onSort={(key) => setSort((prev) => toggleSort(prev, key))}
          />
          <FinanceSortTh
            label="Subjek"
            sortKey="title"
            sort={sort}
            onSort={(key) => setSort((prev) => toggleSort(prev, key))}
          />
          <FinanceTh>Detail</FinanceTh>
          <FinanceSortTh
            label="Status"
            sortKey="status"
            sort={sort}
            onSort={(key) => setSort((prev) => toggleSort(prev, key))}
          />
          <FinanceTh align="center" className="w-24">
            Aksi
          </FinanceTh>
        </FinanceThead>
        <tbody>
          {rows.length === 0 ? (
            <FinanceEmptyRow
              colSpan={6}
              message="Tidak ada item di antrian untuk filter ini."
            />
          ) : (
            rows.map((row, index) => (
              <FinanceTr key={row.id}>
                <FinanceTd mono muted>
                  {rowNumber(safePage, PAGE_SIZE, index)}
                </FinanceTd>
                <FinanceTd muted>{row.kindLabel}</FinanceTd>
                <FinanceTd>
                  {row.useActor ? (
                    <ActorCell name={row.title} />
                  ) : (
                    <span className="num font-medium text-ink">{row.title}</span>
                  )}
                </FinanceTd>
                <FinanceTd muted>{row.detail}</FinanceTd>
                <FinanceTd>
                  <StatusPill label={row.statusLabel} tone={row.tone} />
                </FinanceTd>
                <FinanceTd align="center">
                  <Link
                    to={row.href}
                    className="text-[12px] font-medium text-brand-800 hover:underline"
                  >
                    Buka
                  </Link>
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
  )
}
