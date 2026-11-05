import { useMemo } from 'react'
import { PageSection } from '@/components/ui/PageSection'
import {
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from '@/features/hr/leave-data'

const STATUSES: LeaveStatus[] = ['pending', 'approved', 'rejected', 'cancelled']
const TYPES: LeaveType[] = ['cuti', 'izin', 'sakit', 'dinas']

const STATUS_COLOR: Record<LeaveStatus, string> = {
  pending: '#f59e0b',
  approved: '#216348',
  rejected: '#dc2626',
  cancelled: '#94a3b8',
}

const TYPE_COLOR: Record<LeaveType, string> = {
  cuti: '#216348',
  izin: '#0ea5e9',
  sakit: '#f59e0b',
  dinas: '#64748b',
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max <= 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="truncate text-[12px] text-ink">{label}</p>
        <p className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">
          {value}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-brand-50">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export function HrLeaveOverviewChart({
  requests,
}: {
  requests: LeaveRequest[]
}) {
  const { byStatus, byType, open } = useMemo(() => {
    const statusMap = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
      LeaveStatus,
      number
    >
    const typeMap = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<
      LeaveType,
      number
    >
    for (const r of requests) {
      statusMap[r.status] += 1
      if (r.status === 'pending' || r.status === 'approved') {
        typeMap[r.leaveType] += 1
      }
    }
    return {
      byStatus: statusMap,
      byType: typeMap,
      open: statusMap.pending,
    }
  }, [requests])

  const statusMax = Math.max(1, ...STATUSES.map((s) => byStatus[s]))
  const typeMax = Math.max(1, ...TYPES.map((t) => byType[t]))

  return (
    <PageSection
      title="Cuti & izin"
      subtitle={`${open} menunggu · ${requests.length} total`}
      className="flex h-full flex-col"
    >
      <div className="grid flex-1 gap-4 sm:grid-cols-2 sm:gap-5">
        <div className="space-y-2.5">
          <p className="text-[12px] font-medium text-muted">Status</p>
          {STATUSES.map((s) => (
            <BarRow
              key={s}
              label={LEAVE_STATUS_LABEL[s]}
              value={byStatus[s]}
              max={statusMax}
              color={STATUS_COLOR[s]}
            />
          ))}
        </div>
        <div className="space-y-2.5">
          <p className="text-[12px] font-medium text-muted">Jenis aktif</p>
          {TYPES.map((t) => (
            <BarRow
              key={t}
              label={LEAVE_TYPE_LABEL[t]}
              value={byType[t]}
              max={typeMax}
              color={TYPE_COLOR[t]}
            />
          ))}
        </div>
      </div>
    </PageSection>
  )
}
