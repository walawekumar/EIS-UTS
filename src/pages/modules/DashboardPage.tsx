import { useMemo, useState } from 'react'
import { ActivityTable } from '@/components/dashboard/ActivityTable'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { MiniCalendar } from '@/components/dashboard/MiniCalendar'
import { RangeTabs } from '@/components/dashboard/RangeTabs'
import { StockSnapshot } from '@/components/dashboard/StockSnapshot'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { useAuditStore } from '@/features/audit/audit-store'
import { useAuth } from '@/features/auth/AuthContext'
import { buildLiveDashboard } from '@/features/dashboard/build-live-dashboard'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import { usePenjualan } from '@/features/penjualan/PenjualanContext'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { useProduksi } from '@/features/produksi/ProduksiContext'

const RANGES = [
  { id: '7d', label: '7H' },
  { id: '30d', label: '30H' },
  { id: '90d', label: '90H' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role ?? 'admin'
  const { stocks } = usePersediaanStore()
  const { purchases } = usePembelian()
  const { orders } = usePenjualan()
  const { batches } = useProduksi()
  const { cashEntries, payables, receivables } = useFinanceStore()
  const { logs } = useAuditStore()
  const [range, setRange] = useState('7d')

  const view = useMemo(
    () =>
      buildLiveDashboard({
        role,
        stocks,
        purchases,
        orders,
        batches,
        cash: cashEntries,
        payables,
        receivables,
        audit: logs,
      }),
    [
      role,
      stocks,
      purchases,
      orders,
      batches,
      cashEntries,
      payables,
      receivables,
      logs,
    ],
  )
  const cards = view.metrics.slice(0, 4)

  return (
    <div className="space-y-2.5">
      <DashboardGreeting />

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid items-stretch gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-ink">{view.title}</h2>
              {view.description.trim() ? (
                <p className="mt-0.5 text-[12px] text-muted">{view.description}</p>
              ) : null}
            </div>
            <RangeTabs value={range} options={RANGES} onChange={setRange} />
          </div>
          <div className="min-h-0 flex-1">
            <TrendChart labels={view.chartLabels} series={view.chartSeries} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <div className="rounded-2xl border border-line bg-panel p-3.5 sm:p-4">
            <MiniCalendar />
          </div>
          <div className="flex min-h-0 flex-1 rounded-2xl border border-line bg-panel p-3.5 sm:p-4">
            <StockSnapshot title={view.stockTitle} rows={view.stockRows} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink">Aktivitas terbaru</h3>
        <ActivityTable rows={view.activities} />
      </section>
    </div>
  )
}
