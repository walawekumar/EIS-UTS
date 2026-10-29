import type { SideItem } from '@/features/dashboard/dashboard-data'

export function PriorityPanel({
  title,
  items,
}: {
  title: string
  items: SideItem[]
}) {
  return (
    <section className="flex h-full flex-col">
      <h3 className="border-b border-line pb-2 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
        {title}
      </h3>
      <ol className="mt-1 flex-1">
        {items.map((item, index) => (
          <li
            key={item.title}
            className="border-b border-line py-3 last:border-0"
          >
            <div className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-mono text-[11px] font-semibold text-brand-800">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{item.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">{item.meta}</p>
                {typeof item.progress === 'number' ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
