import { primaryBtn } from '@/components/pembelian/Toolbar'
import { BatchStatusLabel } from '@/components/produksi/BatchStatusLabel'
import { MassBalance } from '@/components/produksi/MassBalance'
import { formatDate, formatKg, formatPercent } from '@/features/pembelian/pembelian-data'
import {
  LOSS_TOLERANCE,
  RENDEMEN_TARGET,
  calcBatch,
  estimateOutputs,
  getLot,
  type Batch,
} from '@/features/produksi/produksi-data'

type BatchDetailProps = {
  batch: Batch
  batches: Batch[]
  onStart: (id: string) => void
  onCancel: (id: string) => void
  onRecord: (id: string) => void
}

const heading = 'text-[12px] font-medium text-muted'

export function BatchDetail({ batch: b, batches, onStart, onCancel, onRecord }: BatchDetailProps) {
  const lot = getLot(b.lotId)
  const calc = b.outputs ? calcBatch(b.inputKg, b.outputs) : null
  const estimate = estimateOutputs(b.inputKg)
  const estimateBeras = estimate.berasKepala + estimate.berasPatah
  const lineBusyBy = batches.find((x) => x.status === 'proses' && x.line === b.line && x.id !== b.id)
  const diff = calc ? calc.rendemen - RENDEMEN_TARGET : 0

  const issues = calc
    ? [
        calc.lowYield ? `Rendemen di bawah target ${RENDEMEN_TARGET}% — cek kadar air gabah dan setelan mesin.` : null,
        calc.lossHigh ? `Selisih massa di atas ${LOSS_TOLERANCE}% — periksa timbangan dan hasil yang tercecer.` : null,
      ].filter((x): x is string => Boolean(x))
    : []

  const info = [
    ['Lot gabah', b.lotId],
    ['Pemasok', lot?.supplier ?? '—'],
    ['Dokumen asal', lot?.source ?? '—'],
    ['Lini & operator', `${b.line} · ${b.operator}`],
    ['Mulai giling', b.startedAt ? formatDate(b.startedAt, { day: 'numeric', month: 'long' }) : 'Belum dimulai'],
    ['Selesai', b.finishedAt ? formatDate(b.finishedAt, { day: 'numeric', month: 'long' }) : '—'],
  ]

  return (
    <section className="tabular-nums">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-ink">{b.id}</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {formatDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <BatchStatusLabel batch={b} />
      </div>

      <div className="mt-5 rounded-xl bg-surface/70 px-4 py-3.5">
        {calc ? (
          <>
            <p className={heading}>Rendemen beras</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[28px] leading-none font-semibold tracking-tight text-ink">
                {formatPercent(calc.rendemen)}
              </span>
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  diff >= 0 ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800',
                ].join(' ')}
              >
                {diff >= 0 ? '+' : '−'}
                {formatPercent(Math.abs(diff)).replace('%', '')} poin dari target
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              {formatKg(calc.beras)} beras dari {formatKg(b.inputKg)} gabah
            </p>
          </>
        ) : (
          <>
            <p className={heading}>Perkiraan beras</p>
            <p className="mt-1 text-[28px] leading-none font-semibold tracking-tight text-ink">
              ± {formatKg(estimateBeras)}
            </p>
            <p className="mt-1.5 text-[12px] text-muted">
              dari {formatKg(b.inputKg)} gabah · rendemen standar {formatPercent((estimateBeras / Math.max(b.inputKg, 1)) * 100)}
            </p>
          </>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <p className={heading}>{calc ? 'Neraca massa' : 'Perkiraan neraca massa'}</p>
          {calc ? (
            <p className={['text-[12px]', calc.lossHigh ? 'font-medium text-red-700' : 'text-muted'].join(' ')}>
              selisih {formatPercent(calc.lossPct)}
            </p>
          ) : null}
        </div>
        <MassBalance inputKg={b.inputKg} outputs={b.outputs ?? estimate} />
      </div>

      {issues.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {issues.map((text) => (
            <li key={text} className="flex gap-2 text-[12px] leading-relaxed text-red-800">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" />
              {text}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-5 divide-y divide-line border-t border-line text-[13px]">
        {info.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-muted">{label}</dt>
            <dd className="min-w-0 truncate text-right text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {b.note ? <p className="mt-3 text-[12px] leading-relaxed text-muted italic">“{b.note}”</p> : null}

      {b.status === 'rencana' ? (
        <div className="mt-5 space-y-2">
          <button
            type="button"
            className={[primaryBtn, 'w-full'].join(' ')}
            disabled={Boolean(lineBusyBy)}
            onClick={() => onStart(b.id)}
          >
            Mulai giling di {b.line}
          </button>
          {lineBusyBy ? (
            <p className="text-center text-[12px] text-muted">
              {b.line} masih dipakai {lineBusyBy.id}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => onCancel(b.id)}
            className="w-full py-1 text-center text-[12px] font-medium text-muted transition hover:text-red-700"
          >
            Batalkan rencana
          </button>
        </div>
      ) : null}

      {b.status === 'proses' ? (
        <button type="button" className={[primaryBtn, 'mt-5 w-full'].join(' ')} onClick={() => onRecord(b.id)}>
          Catat hasil giling
        </button>
      ) : null}
    </section>
  )
}
