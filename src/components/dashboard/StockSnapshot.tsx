export type StockRow = {
  label: string
  value: string
  percent: number
  tone?: 'ok' | 'warn'
}

export function StockSnapshot({
  title = 'Saldo gudang',
  rows,
}: {
  title?: string
  rows: StockRow[]
}) {
  return (
    <section className="flex h-full w-full flex-col">
      <div className="mb-2.5 flex items-end justify-between gap-2 border-b border-line pb-2">
        <h3 className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
          {title}
        </h3>
        <span className="font-mono text-[10px] text-muted">hari ini</span>
      </div>

      <ul className="flex flex-1 flex-col justify-between gap-2.5">
        {rows.map((row) => {
          const pct = Math.min(100, Math.max(0, row.percent))
          const warn = row.tone === 'warn' || pct >= 85 || pct <= 20
          return (
            <li key={row.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-medium text-ink">{row.label}</p>
                <p className="num shrink-0 text-[12px] font-semibold text-ink">{row.value}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-50">
                <div
                  className={[
                    'h-full rounded-full transition-[width]',
                    warn ? 'bg-amber-600' : 'bg-brand-700',
                  ].join(' ')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted">{pct}% kapasitas</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
