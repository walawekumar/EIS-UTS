import { useState, type FormEvent } from 'react'
import { primaryBtn, secondaryBtn, sectionLabel } from '@/components/pembelian/Toolbar'
import { DrawerShell } from '@/components/produksi/DrawerShell'
import { MassBalance } from '@/components/produksi/MassBalance'
import { TextField } from '@/components/ui/TextField'
import { formatKg, formatPercent, parseNumber, todayIso } from '@/features/pembelian/pembelian-data'
import {
  LOSS_TOLERANCE,
  OUTPUTS,
  RENDEMEN_TARGET,
  calcBatch,
  estimateOutputs,
  getLot,
  type Batch,
  type BatchOutputs,
  type OutputKey,
} from '@/features/produksi/produksi-data'

type HasilFormDrawerProps = {
  batch: Batch
  onClose: () => void
  onSave: (outputs: BatchOutputs, finishedAt: string, note?: string) => void
}

export function HasilFormDrawer({ batch, onClose, onSave }: HasilFormDrawerProps) {
  const [form, setForm] = useState<Record<OutputKey, string>>(
    () => Object.fromEntries(OUTPUTS.map((o) => [o.key, ''])) as Record<OutputKey, string>,
  )
  const [finishedAt, setFinishedAt] = useState(todayIso())
  const [note, setNote] = useState(batch.note ?? '')
  const [error, setError] = useState<string>()

  const outputs = Object.fromEntries(OUTPUTS.map((o) => [o.key, parseNumber(form[o.key])])) as BatchOutputs
  const calc = calcBatch(batch.inputKg, outputs)
  const estimate = estimateOutputs(batch.inputKg)
  const filled = calc.totalOutput > 0
  const lot = getLot(batch.lotId)

  function fillEstimate() {
    setForm(Object.fromEntries(OUTPUTS.map((o) => [o.key, String(estimate[o.key])])) as Record<OutputKey, string>)
    setError(undefined)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (outputs.berasKepala <= 0) return setError('Isi berat beras kepala')
    if (OUTPUTS.some((o) => outputs[o.key] < 0)) return setError('Berat tidak boleh negatif')
    if (calc.loss < 0) return setError(`Total output (${formatKg(calc.totalOutput)}) melebihi input ${formatKg(batch.inputKg)}`)
    onSave(outputs, finishedAt, note.trim() || undefined)
  }

  return (
    <DrawerShell
      open
      eyebrow="Catat hasil giling"
      title={batch.id}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {error ? <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p> : null}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={onClose} className={secondaryBtn}>
              Batal
            </button>
            <button type="submit" className={primaryBtn}>
              Simpan hasil & selesaikan batch
            </button>
          </div>
        </>
      }
    >
      <div className="rounded-xl bg-surface px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[12px] text-muted">Input gabah</p>
          <p className="tabular-nums text-[16px] font-semibold text-ink">{formatKg(batch.inputKg)}</p>
        </div>
        <p className="tabular-nums mt-0.5 truncate text-[11px] text-muted">
          {batch.lotId} · {lot?.supplier} · {batch.line} · {batch.operator}
        </p>
      </div>

      <section className="space-y-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className={sectionLabel}>Berat hasil timbang (kg)</p>
          <button
            type="button"
            onClick={fillEstimate}
            className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
          >
            Isi perkiraan standar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {OUTPUTS.map((o) => (
            <TextField
              key={o.key}
              id={`hs-${o.key}`}
              label={o.label}
              requiredMark={o.key === 'berasKepala'}
              inputMode="decimal"
              placeholder={`± ${estimate[o.key]}`}
              value={form[o.key]}
              onChange={(e) => {
                setForm((f) => ({ ...f, [o.key]: e.target.value }))
                setError(undefined)
              }}
              leading={<span className={['block size-2 rounded-full', o.tone].join(' ')} />}
            />
          ))}
          <TextField
            id="hs-date"
            label="Tanggal selesai"
            type="date"
            value={finishedAt}
            onChange={(e) => setFinishedAt(e.target.value)}
          />
        </div>
        <TextField id="hs-note" label="Catatan" placeholder="Opsional" value={note} onChange={(e) => setNote(e.target.value)} />
      </section>

      <section>
        <p className={[sectionLabel, 'mb-3'].join(' ')}>Neraca massa</p>
        {filled ? (
          <MassBalance inputKg={batch.inputKg} outputs={outputs} />
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-[12px] text-muted">
            Isi berat hasil timbang untuk melihat neraca massa.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className={['rounded-xl px-3 py-2.5', !filled ? 'bg-surface' : calc.lowYield ? 'bg-amber-50' : 'bg-brand-50'].join(' ')}>
            <p className="text-[11px] text-muted">Rendemen beras</p>
            <p
              className={[
                'tabular-nums mt-0.5 text-[18px] font-semibold',
                !filled ? 'text-muted' : calc.lowYield ? 'text-amber-700' : 'text-brand-800',
              ].join(' ')}
            >
              {filled ? formatPercent(calc.rendemen) : '—'}
            </p>
            <p className="text-[11px] text-muted">target ≥ {RENDEMEN_TARGET}%</p>
          </div>
          <div className={['rounded-xl px-3 py-2.5', !filled ? 'bg-surface' : calc.lossHigh ? 'bg-red-50' : 'bg-brand-50'].join(' ')}>
            <p className="text-[11px] text-muted">Selisih massa</p>
            <p
              className={[
                'tabular-nums mt-0.5 text-[18px] font-semibold',
                !filled ? 'text-muted' : calc.lossHigh ? 'text-red-700' : 'text-brand-800',
              ].join(' ')}
            >
              {filled ? formatPercent(calc.lossPct) : '—'}
            </p>
            <p className="text-[11px] text-muted">wajar ≤ {LOSS_TOLERANCE}%</p>
          </div>
        </div>
      </section>
    </DrawerShell>
  )
}
