import { formatKg, formatPercent } from '@/features/pembelian/pembelian-data'
import { LOSS_TONE, OUTPUTS, type BatchOutputs } from '@/features/produksi/produksi-data'

/** Neraca massa: input gabah dibagi ke tiap output + selisih (susut). */
export function MassBalance({
  inputKg,
  outputs,
  compact = false,
}: {
  inputKg: number
  outputs: Partial<BatchOutputs>
  compact?: boolean
}) {
  const parts = OUTPUTS.map((o) => ({ key: o.key as string, label: o.label, tone: o.tone, kg: outputs[o.key] ?? 0 }))
  const loss = inputKg - parts.reduce((sum, p) => sum + p.kg, 0)
  const all = [...parts, { key: 'selisih', label: 'Selisih / susut', tone: LOSS_TONE, kg: loss }]
  const base = Math.max(inputKg, inputKg - loss, 1)
  const pct = (kg: number) => formatPercent(inputKg > 0 ? (kg / inputKg) * 100 : 0)

  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface">
        {all.map((p) =>
          p.kg > 0 ? (
            <div
              key={p.key}
              className={['h-full', p.tone].join(' ')}
              style={{ width: `${(p.kg / base) * 100}%` }}
              title={`${p.label}: ${formatKg(p.kg)} (${pct(p.kg)})`}
            />
          ) : null,
        )}
      </div>

      {!compact ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-[12px]">
          {all.map((p) => (
            <div key={p.key} className="flex min-w-0 items-center gap-2" title={pct(p.kg)}>
              <dt className="flex min-w-0 flex-1 items-center gap-2 text-muted">
                <span className={['size-2 shrink-0 rounded-full', p.tone].join(' ')} />
                <span className="truncate">{p.label}</span>
              </dt>
              <dd
                className={[
                  'shrink-0 font-medium tabular-nums',
                  p.key === 'selisih' && p.kg < 0 ? 'text-red-700' : 'text-ink',
                ].join(' ')}
              >
                {p.kg < 0 ? '−' : ''}
                {formatKg(Math.abs(p.kg))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
