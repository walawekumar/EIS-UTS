import { useMemo, useState } from 'react'
import { ActivityTable } from '@/components/dashboard/ActivityTable'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { MiniCalendar } from '@/components/dashboard/MiniCalendar'
import { StockSnapshot } from '@/components/dashboard/StockSnapshot'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { useAuth } from '@/features/auth/AuthContext'
import { buildOpsActivity } from '@/features/dashboard/build-ops-activity'
import { buildLiveDashboard } from '@/features/dashboard/build-live-dashboard'
import {
  buildOpsTrend,
  type ChartRange,
} from '@/features/dashboard/build-ops-trend'
import { buildOpsCalendarEvents } from '@/features/dashboard/calendar-events'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { usePeriodStore } from '@/features/keuangan/period-store'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import { usePenjualan } from '@/features/penjualan/PenjualanContext'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { useProduksi } from '@/features/produksi/ProduksiContext'

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
  const [range, setRange] = useState<ChartRange>('30d')

  const calendarEvents = useMemo(
    () =>
      buildOpsCalendarEvents({
        purchases,
        orders,
        batches,
        lotQc,
        payables,
        receivables,
        periodLocks,
      }),
    [
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
  ])

  const trend = useMemo(
    () =>
      buildOpsTrend({
        range,
        purchases,
        orders,
        cash: cashEntries,
      }),
    [range, purchases, orders, cashEntries],
  )

  const activities = useMemo(
    () =>
      buildOpsActivity({
        purchases,
        orders,
        batches,
        cash: cashEntries,
      }),
    [purchases, orders, batches, cashEntries],
  )

  if (!user || !view) return null
  const cards = view.metrics.slice(0, 4)
  const hasChartData = trend.series.some((s) => s.values.some((v) => v > 0))

  return (
    <div className="space-y-2.5">
      <DashboardGreeting />

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid items-stretch gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-h-[440px] flex-col rounded-2xl border border-line bg-panel p-4 sm:min-h-[480px] sm:p-5">
          <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">
                Tren operasional
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {trend.title} · Beli / Jual / Kas masuk (jt Rp)
              </p>
            </div>
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
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {hasChartData ? (
              <TrendChart
                key={`${range}:${trend.labels.join('|')}`}
                labels={trend.labels}
                series={trend.series}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line px-4 text-center">
                <p className="text-[13px] text-muted">
                  Belum ada transaksi di rentang ini. Grafik terisi otomatis
                  setelah pembelian, penjualan, atau kas masuk tercatat.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <div className="rounded-2xl border border-line bg-panel p-3.5 sm:p-4">
            <MiniCalendar events={calendarEvents} />
          </div>
          <div className="flex min-h-0 flex-1 rounded-2xl border border-line bg-panel p-3.5 sm:p-4">
            <StockSnapshot title={view.stockTitle} rows={view.stockRows} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h3 className="mb-1 text-[14px] font-semibold text-ink">
          Dokumen terbaru
        </h3>
        <p className="mb-3 text-[12px] text-muted">
          Pembelian, penjualan, produksi, dan kas, bukan audit log sistem.
        </p>
        <ActivityTable rows={activities} />
      </section>
    </div>
  )
}
