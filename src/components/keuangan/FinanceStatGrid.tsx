import { MetricCard } from '@/components/dashboard/MetricCard'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'

export function FinanceStatGrid({ stats }: { stats: MetricCardData[] }) {
  const cols =
    stats.length <= 1
      ? 'grid-cols-1'
      : stats.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : stats.length === 3
          ? 'grid-cols-1 sm:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'

  return (
    <section className={['grid gap-2.5', cols].join(' ')}>
      {stats.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </section>
  )
}
