import { useMemo, useState } from 'react'
import { AbsensiMonthChart } from '@/components/absensi/AbsensiMonthChart'
import { ActivityTable } from '@/components/dashboard/ActivityTable'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { MiniCalendar } from '@/components/dashboard/MiniCalendar'
import { StockSnapshot } from '@/components/dashboard/StockSnapshot'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { HrLeaveOverviewChart } from '@/components/hr/HrLeaveOverviewChart'
import { todayIsoDate } from '@/features/absensi/absensi-data'
import type { ActivityRow } from '@/features/dashboard/dashboard-data'
import { LEAVE_TYPE_LABEL } from '@/features/hr/leave-data'
import { useAbsensiStore } from '@/features/absensi/absensi-store'
import { useAuth } from '@/features/auth/AuthContext'
import { buildOpsActivity } from '@/features/dashboard/build-ops-activity'
import { buildLiveDashboard } from '@/features/dashboard/build-live-dashboard'
import {
  buildOpsTrend,
  type ChartRange,
} from '@/features/dashboard/build-ops-trend'
import {
  buildOpsCalendarEvents,
  type CalendarEvent,
} from '@/features/dashboard/calendar-events'
import { useLeaveStore } from '@/features/hr/leave-store'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { usePeriodStore } from '@/features/keuangan/period-store'
import { usePayrollStore } from '@/features/payroll/payroll-store'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import { usePenjualan } from '@/features/penjualan/PenjualanContext'
import { isLowStock } from '@/features/persediaan/persediaan-data'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { useProduksi } from '@/features/produksi/ProduksiContext'
import type { UserRole } from '@/types/auth'

const TREND_SERIES: Partial<Record<UserRole, string[]>> = {
  admin: ['Beli', 'Jual', 'Kas masuk'],
  keuangan: ['Beli', 'Jual', 'Kas masuk'],
  pembelian: ['Beli'],
  penjualan: ['Jual'],
}

function activityInclude(role: UserRole) {
  if (role === 'admin' || role === 'keuangan') return undefined
  return {
    purchase: role === 'pembelian',
    sale: role === 'penjualan',
    batch: role === 'produksi' || role === 'gudang',
    cash: false,
  }
}

function calendarVisible(role: UserRole, event: CalendarEvent): boolean {
  if (role === 'admin' || role === 'keuangan') return true
  if (role === 'pembelian') {
    return event.id.startsWith('po-') || event.id.startsWith('qc-') || event.id.startsWith('ap-')
  }
  if (role === 'penjualan') {
    return event.id.startsWith('so-') || event.id.startsWith('ar-')
  }
  if (role === 'produksi' || role === 'gudang') return event.id.startsWith('batch-')
  return false
}

const RANGE_OPTIONS: { id: ChartRange; label: string }[] = [
  { id: '7d', label: 'Minggu' },
  { id: '30d', label: 'Bulan' },
  { id: '12m', label: 'Tahun' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const { stocks } = usePersediaanStore()
  const { purchases, lotQc } = usePembelian()
  const { orders } = usePenjualan()
  const { batches } = useProduksi()
  const { cashEntries, payables, receivables } = useFinanceStore()
  const { locks: periodLocks } = usePeriodStore()
  const { records } = useAbsensiStore()
  const { requests } = useLeaveStore()
  const { runs } = usePayrollStore()
  const [range, setRange] = useState<ChartRange>('12m')
  const today = todayIsoDate()

  const calendarEvents = useMemo(
    () => {
      const all = buildOpsCalendarEvents({
        purchases,
        orders,
        batches,
        lotQc,
        payables,
        receivables,
        periodLocks,
      })
      if (!user) return all
      return all.filter((event) => calendarVisible(user.role, event))
    },
    [
      user,
      purchases,
      orders,
      batches,
      lotQc,
      payables,
      receivables,
      periodLocks,
    ],
  )

  const view = useMemo(() => {
    if (!user) return null
    const pendingLeave = requests.filter((r) => r.status === 'pending').length
    const presentToday = records.filter((r) => r.date === today).length
    const lateToday = records.filter(
      (r) => r.date === today && r.status === 'terlambat',
    ).length
    const payrollQueue = runs.filter((r) =>
      user.role === 'hr'
        ? r.status === 'menunggu_hr'
        : r.status === 'menunggu_admin',
    ).length
    return buildLiveDashboard({
      role: user.role,
      stocks,
      purchases,
      orders,
      batches,
      cash: cashEntries,
      payables,
      receivables,
      audit: [],
      hrFocus: {
        pendingLeave,
        presentToday,
        lateToday,
        payrollQueue,
      },
    })
  }, [
    user,
    stocks,
    purchases,
    orders,
    batches,
    cashEntries,
    payables,
    receivables,
    requests,
    records,
    runs,
    today,
  ])

  const trend = useMemo(() => {
    const full = buildOpsTrend({
      range,
      purchases,
      orders,
      cash: cashEntries,
    })
    const names = user ? TREND_SERIES[user.role] : undefined
    if (!names) return { ...full, series: [] }
    return {
      ...full,
      series: full.series.filter((s) => names.includes(s.name)),
    }
  }, [range, purchases, orders, cashEntries, user])

  const activities = useMemo(() => {
    if (user?.role === 'hr') {
      const leaveRows: ActivityRow[] = requests
        .filter((r) => r.status === 'pending')
        .map((r) => ({
          date: r.startDate,
          type: 'Cuti',
          reference: r.userName,
          amount: `${LEAVE_TYPE_LABEL[r.leaveType]} · ${r.days} hari`,
          status: 'warn',
          actor: r.userName,
        }))
      const lateRows: ActivityRow[] = records
        .filter((r) => r.date === today && r.status === 'terlambat')
        .map((r) => ({
          date: r.date,
          type: 'Absensi',
          reference: r.userName,
          amount: 'Terlambat',
          status: 'warn',
          actor: r.userName,
        }))
      return [...leaveRows, ...lateRows].slice(0, 12)
    }
    return buildOpsActivity({
      purchases,
      orders,
      batches,
      cash: cashEntries,
      include: user ? activityInclude(user.role) : undefined,
    })
  }, [purchases, orders, batches, cashEntries, user, requests, records, today])

  const lowStocks = useMemo(
    () => stocks.filter(isLowStock).slice(0, 8),
    [stocks],
  )
  const openBatches = useMemo(
    () => batches.filter((b) => b.stage !== 'done' && b.stage !== 'void').slice(0, 8),
    [batches],
  )

  if (!user || !view) return null
  const cards = view.metrics.slice(0, 4)
  const moneySeries = TREND_SERIES[user.role]
  const hasChartData = trend.series.some((s) => s.values.some((v) => v > 0))
  const trendCaption = moneySeries?.join(' / ') ?? ''

  return (
    <div className="space-y-2.5">
      <DashboardGreeting />

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid items-stretch gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
        {user.role === 'hr' ? (
          <AbsensiMonthChart records={records} days={30} />
        ) : (
        <div className="flex min-h-[440px] flex-col rounded-2xl border border-line bg-panel p-4 sm:min-h-[480px] sm:p-5">
          <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">
                {user.role === 'gudang'
                  ? 'Stok perlu perhatian'
                  : user.role === 'produksi'
                    ? 'Batch berjalan'
                    : 'Tren operasional'}
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {user.role === 'gudang'
                  ? 'Hanya saldo di bawah ambang'
                  : user.role === 'produksi'
                    ? 'Batch yang belum selesai'
                    : `${trend.title} · ${trendCaption} (jt Rp)`}
              </p>
            </div>
            {moneySeries ? (
            <div className="inline-flex rounded-xl border border-line p-0.5">
              {RANGE_OPTIONS.map((opt) => {
                const active = range === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRange(opt.id)}
                    className={[
                      'rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium transition',
                      active
                        ? 'bg-brand-800 text-white'
                        : 'text-muted hover:bg-brand-50 hover:text-ink',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {user.role === 'gudang' ? (
              <ul className="flex flex-1 flex-col justify-center gap-2">
                {lowStocks.length === 0 ? (
                  <li className="text-[13px] text-muted">Tidak ada stok di bawah ambang.</li>
                ) : (
                  lowStocks.map((row) => (
                    <li key={row.sku + row.location} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-ink">{row.name}</span>
                      <span className="shrink-0 text-muted">
                        {row.qty.toLocaleString('id-ID')} {row.unit} · {row.location}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            ) : user.role === 'produksi' ? (
              <ul className="flex flex-1 flex-col justify-center gap-2">
                {openBatches.length === 0 ? (
                  <li className="text-[13px] text-muted">Tidak ada batch berjalan.</li>
                ) : (
                  openBatches.map((row) => (
                    <li key={row.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-medium text-ink">{row.id}</span>
                      <span className="text-muted">{row.stage}</span>
                    </li>
                  ))
                )}
              </ul>
            ) : hasChartData ? (
              <TrendChart
                key={`${range}:${trend.labels.join('|')}:${trend.series.map((s) => s.name).join(',')}`}
                labels={trend.labels}
                series={trend.series}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line px-4 text-center">
                <p className="text-[13px] text-muted">
                  Belum ada transaksi {trendCaption.toLowerCase()} di rentang ini.
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="flex min-h-0 flex-col gap-2.5">
          <div className="rounded-2xl border border-line bg-panel p-3.5 sm:p-4">
            <MiniCalendar events={calendarEvents} />
          </div>
          {user.role === 'hr' ? (
            <HrLeaveOverviewChart requests={requests} />
          ) : (
            <div className="flex min-h-0 flex-1 rounded-2xl border border-line bg-panel p-3.5 sm:p-4">
              <StockSnapshot title={view.stockTitle} rows={view.stockRows} />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h3 className="mb-1 text-[14px] font-semibold text-ink">
          {user.role === 'hr' ? 'Antrian SDM' : 'Dokumen terbaru'}
        </h3>
        <p className="mb-3 text-[12px] text-muted">
          {user.role === 'hr'
            ? 'Cuti menunggu dan keterlambatan hari ini.'
            : user.role === 'admin' || user.role === 'keuangan'
              ? 'Pembelian, penjualan, produksi, dan kas.'
              : 'Hanya dokumen yang sesuai peran Anda.'}
        </p>
        <ActivityTable rows={activities} />
      </section>
    </div>
  )
}
