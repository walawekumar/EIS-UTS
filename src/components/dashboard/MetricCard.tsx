import type { MetricCardData } from '@/features/dashboard/dashboard-data'

function Sparkline({ values }: { values: number[] }) {
  const w = 72
  const h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[72px]" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="#2a7a58"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  )
}

function looksLikePct(delta: string): boolean {
  return /[−\-+]?\d+[.,]?\d*\s*%/.test(delta.trim())
}

export function MetricCard({ metric }: { metric: MetricCardData }) {
  const pct = looksLikePct(metric.delta)
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5 shadow-[0_1px_2px_rgba(20,32,25,0.04)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-muted">
          {metric.label}
        </p>
        <p className="num mt-1.5 truncate text-[20px] leading-none font-semibold tracking-tight text-ink">
          {metric.value}
        </p>
        <p className="mt-2">
          <span
            className={[
              'inline-flex max-w-full truncate font-mono text-[11px] font-semibold',
              pct
                ? [
                    'rounded-full px-2 py-0.5',
                    metric.positive
                      ? 'bg-brand-50 text-brand-800'
                      : 'bg-amber-50 text-amber-800',
                  ].join(' ')
                : metric.positive
                  ? 'text-brand-700'
                  : 'text-amber-700',
            ].join(' ')}
          >
            {metric.delta}
          </span>
        </p>
      </div>
      <Sparkline values={metric.spark} />
    </article>
  )
}
