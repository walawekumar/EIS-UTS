import type { SideItem } from '@/features/dashboard/dashboard-data'

export function PriorityPanel({
  title,
  items,
}: {
  title: string
  items: SideItem[]
}) {
  return (
    <section>
      <h3 className="border-b border-line pb-2 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
        {title}
      </h3>
      <ol className="mt-1">
        {items.map((item, index) => (
          <li
            key={item.title}
            className="flex gap-3 border-b border-line py-3 last:border-0"
          >
            <span className="num w-4 shrink-0 text-[12px] text-muted">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{item.title}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted">{item.meta}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
