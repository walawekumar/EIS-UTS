import { MetricCard } from '@/components/dashboard/MetricCard'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'

export function FinanceStatGrid({ stats }: { stats: MetricCardData[] }) {
  return (
    <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </section>
  )
}
