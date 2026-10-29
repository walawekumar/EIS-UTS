import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityTable } from '@/components/dashboard/ActivityTable'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { MiniCalendar } from '@/components/dashboard/MiniCalendar'
import { PriorityPanel } from '@/components/dashboard/PriorityPanel'
import { RangeTabs } from '@/components/dashboard/RangeTabs'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { useAuth } from '@/features/auth/AuthContext'
import { DASHBOARD_BY_ROLE } from '@/features/dashboard/dashboard-data'
import { getNavForRole } from '@/features/nav/nav-config'

const RANGES = [
  { id: '7d', label: '7H' },
  { id: '30d', label: '30H' },
  { id: '90d', label: '90H' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role ?? 'admin'
  const view = DASHBOARD_BY_ROLE[role]
  const [range, setRange] = useState('7d')
  const cards = view.metrics.slice(0, 4)

  const shortcuts = user
    ? getNavForRole(user.role)
        .flatMap((g) => g.items)
        .filter((item) => item.path !== '/app/dashboard')
        .slice(0, 4)
    : []

  return (
    <div className="space-y-3">
      <DashboardGreeting />

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      {shortcuts.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2.5">
          <span className="mr-1 text-[11px] font-medium tracking-wide text-muted uppercase">
            Pintasan
          </span>
          {shortcuts.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className="rounded-xl border border-line px-2.5 py-1 text-[12px] font-medium text-ink transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
            >
              {item.label}
            </Link>
          ))}
        </section>
      ) : null}

      <section className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border border-line bg-panel p-4 sm:p-4">
          <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-ink">{view.title}</h2>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-muted">
                {view.description}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {view.chartTitle} · {range}
              </p>
            </div>
            <RangeTabs value={range} options={RANGES} onChange={setRange} />
          </div>
          <TrendChart labels={view.chartLabels} series={view.chartSeries} />
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="rounded-2xl border border-line bg-panel p-4">
            <MiniCalendar />
          </div>
          <div className="rounded-2xl border border-line bg-panel p-4">
            <PriorityPanel title={view.sideTitle} items={view.sideItems.slice(0, 3)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-ink">Aktivitas terbaru</h3>
          <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-[11px] text-brand-800">
            contoh MVP
          </span>
        </div>
        <ActivityTable rows={view.activities} />
      </section>
    </div>
  )
}
