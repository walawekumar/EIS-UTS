import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityTable } from '@/components/dashboard/ActivityTable'
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
  const primary = view.metrics[0]
  const rest = view.metrics.slice(1)

  const shortcuts = user
    ? getNavForRole(user.role)
        .flatMap((g) => g.items)
        .filter((item) => item.path !== '/app/dashboard')
        .slice(0, 3)
    : []

  return (
    <div className="space-y-6">
      {/* Satu komposisi atas: angka utama + metrik sekunder inline */}
      <section className="grid gap-6 border border-line bg-panel p-4 lg:grid-cols-[1.1fr_1fr] lg:p-5">
        <div>
          <p className="text-[11px] tracking-[0.08em] text-muted uppercase">
            {user?.roleLabel}
          </p>
          <h2 className="mt-2 text-[15px] font-medium text-ink">{view.title}</h2>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">
            {view.description}
          </p>

          {primary ? (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-[11px] text-muted">{primary.label}</p>
              <p className="num mt-1 text-[34px] leading-none font-medium tracking-tight text-ink">
                {primary.value}
              </p>
              <p className="mt-2 font-mono text-[12px] text-muted">
                {primary.delta} dibanding periode sebelumnya
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div className="flex justify-end">
            <RangeTabs value={range} options={RANGES} onChange={setRange} />
          </div>
          <dl className="divide-y divide-line border-t border-line">
            {rest.map((metric) => (
              <div
                key={metric.label}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <dt className="text-[13px] text-muted">{metric.label}</dt>
                <dd className="text-right">
                  <span className="num block text-[15px] font-medium text-ink">
                    {metric.value}
                  </span>
                  <span className="num text-[11px] text-muted">{metric.delta}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">{view.chartTitle}</h3>
              <p className="font-mono text-[11px] text-muted">
                {view.chartUnit} · {range}
              </p>
            </div>
            {shortcuts.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {shortcuts.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="text-[12px] font-medium text-brand-800 underline-offset-2 hover:underline"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <TrendChart labels={view.chartLabels} series={view.chartSeries} />
        </div>

        <div className="border border-line bg-panel p-4 sm:p-5">
          <PriorityPanel title={view.sideTitle} items={view.sideItems} />
        </div>
      </section>

      <section className="border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-2 border-b border-line pb-2">
          <h3 className="text-[13px] font-semibold text-ink">Aktivitas terbaru</h3>
          <span className="font-mono text-[11px] text-muted">contoh MVP</span>
        </div>
        <ActivityTable rows={view.activities} />
      </section>
    </div>
  )
}
