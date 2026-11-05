import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AbsensiMonthChart } from '@/components/absensi/AbsensiMonthChart'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import { HrLeaveOverviewChart } from '@/components/hr/HrLeaveOverviewChart'
import { HrQueueTable } from '@/components/hr/HrQueueTable'
import { useAbsensiStore } from '@/features/absensi/absensi-store'
import { todayIsoDate } from '@/features/absensi/absensi-data'
import { useAuth } from '@/features/auth/AuthContext'
import { useLeaveStore } from '@/features/hr/leave-store'
import { usePayrollStore } from '@/features/payroll/payroll-store'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'

function canHr(role: string | undefined): boolean {
  return role === 'admin' || role === 'hr'
}

export function HrHomePage() {
  const { user } = useAuth()
  const { requests } = useLeaveStore()
  const { records } = useAbsensiStore()
  const { runs } = usePayrollStore()
  const [attDays, setAttDays] = useState(7)

  const today = todayIsoDate()

  const pendingLeave = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests],
  )

  const lateToday = useMemo(
    () =>
      records.filter((r) => r.date === today && r.status === 'terlambat'),
    [records, today],
  )

  const hadirToday = useMemo(
    () => records.filter((r) => r.date === today).length,
    [records, today],
  )

  const payrollQueue = useMemo(() => {
    if (!user) return []
    if (user.role === 'hr') {
      return runs.filter((r) => r.status === 'menunggu_hr')
    }
    return runs.filter((r) => r.status === 'menunggu_admin')
  }, [runs, user])

  const draftCount = useMemo(
    () => runs.filter((r) => r.status === 'draft').length,
    [runs],
  )

  const stats = useMemo((): MetricCardData[] => {
    return [
      {
        label: 'Cuti menunggu',
        value: String(pendingLeave.length),
        delta: pendingLeave.length ? 'Perlu review' : 'Kosong',
        positive: pendingLeave.length === 0,
      },
      {
        label: 'Hadir hari ini',
        value: String(hadirToday),
        delta: lateToday.length
          ? `${lateToday.length} terlambat`
          : `${hadirToday} orang`,
        positive: lateToday.length === 0,
      },
      {
        label: user?.role === 'hr' ? 'Payroll (HR)' : 'Payroll (admin)',
        value: String(payrollQueue.length),
        delta: payrollQueue.length ? 'Perlu stamp' : 'Kosong',
        positive: payrollQueue.length === 0,
      },
      {
        label: 'Draft gaji',
        value: String(draftCount),
        delta: draftCount ? 'Belum diajukan' : 'Kosong',
        positive: true,
      },
    ]
  }, [
    pendingLeave.length,
    hadirToday,
    lateToday.length,
    payrollQueue.length,
    draftCount,
    user?.role,
  ])

  if (!user) return null
  if (!canHr(user.role)) return <Navigate to="/absensi/cuti" replace />

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <AbsensiMonthChart
        records={records}
        days={attDays}
        showRangeFilter
        onDaysChange={setAttDays}
      />

      <HrLeaveOverviewChart requests={requests} />

      <HrQueueTable
        leave={requests}
        payroll={payrollQueue}
        lateToday={lateToday}
      />
    </div>
  )
}
