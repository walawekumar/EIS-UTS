export type StatItem = {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warn' | 'danger' | 'good'
}

const TONE: Record<NonNullable<StatItem['tone']>, string> = {
  default: 'text-ink',
  warn: 'text-amber-700',
  danger: 'text-red-700',
  good: 'text-brand-700',
}

export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.label}
          className="min-w-0 rounded-2xl border border-line bg-panel px-4 py-3 shadow-[0_1px_2px_rgba(20,32,25,0.04)]"
        >
          <p className="truncate text-[12px] font-medium text-muted">{item.label}</p>
          <p
            className={[
              'num mt-1.5 truncate text-[20px] leading-none font-semibold tracking-tight',
              TONE[item.tone ?? 'default'],
            ].join(' ')}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-1.5 truncate font-mono text-[11px] text-muted">{item.hint}</p>
          ) : null}
        </article>
      ))}
    </section>
  )
}
