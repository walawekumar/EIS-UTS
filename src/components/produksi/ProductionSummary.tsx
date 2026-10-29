import { formatKg, formatPercent } from '@/features/pembelian/pembelian-data'
import { RENDEMEN_TARGET, calcBatch, needsReview, type Batch } from '@/features/produksi/produksi-data'

/** Ringkasan produksi dalam satu panel, dipisah garis tipis. */
export function ProductionSummary({ batches }: { batches: Batch[] }) {
  const done = batches.filter((b) => b.status === 'selesai' && b.outputs)
  const running = batches.filter((b) => b.status === 'proses')
  const planned = batches.filter((b) => b.status === 'rencana')
  const input = done.reduce((sum, b) => sum + b.inputKg, 0)
  const beras = done.reduce((sum, b) => sum + calcBatch(b.inputKg, b.outputs ?? {}).beras, 0)
  const kepala = done.reduce((sum, b) => sum + (b.outputs?.berasKepala ?? 0), 0)
  const rendemen = input > 0 ? (beras / input) * 100 : 0
  const diff = rendemen - RENDEMEN_TARGET
  const review = batches.filter(needsReview).length

  const items = [
    {
      label: 'Sedang giling',
      value: `${running.length} batch`,
      hint: running.length > 0 ? running.map((b) => b.line).join(', ') + ' aktif' : 'Semua lini kosong',
    },
    {
      label: 'Gabah digiling',
      value: formatKg(input),
      hint: `${done.length} batch selesai · ${planned.length} direncanakan`,
    },
    {
      label: 'Beras dihasilkan',
      value: formatKg(beras),
      hint: `${beras > 0 ? Math.round((kepala / beras) * 100) : 0}% beras kepala`,
    },
    {
      label: 'Rata-rata rendemen',
      value: formatPercent(rendemen),
      hint: review > 0 ? `${review} batch perlu ditinjau` : `Target ${RENDEMEN_TARGET}%`,
      badge: `${diff >= 0 ? '+' : '−'}${formatPercent(Math.abs(diff)).replace('%', '')} poin`,
      good: diff >= 0,
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-panel px-5 py-4">
          <p className="text-[12px] text-muted">{item.label}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="truncate text-[22px] leading-none font-semibold tracking-tight text-ink tabular-nums">
              {item.value}
            </p>
            {item.badge ? (
              <span
                className={[
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
                  item.good ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-800',
                ].join(' ')}
              >
                {item.badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 truncate text-[12px] text-muted">{item.hint}</p>
        </div>
      ))}
    </section>
  )
}
