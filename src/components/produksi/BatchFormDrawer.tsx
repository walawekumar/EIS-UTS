import { useState, type FormEvent } from 'react'
import { primaryBtn, secondaryBtn, sectionLabel } from '@/components/pembelian/Toolbar'
import { DrawerShell } from '@/components/produksi/DrawerShell'
import { MassBalance } from '@/components/produksi/MassBalance'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { formatDate, formatKg, parseNumber, todayIso } from '@/features/pembelian/pembelian-data'
import {
  GRAIN_LOTS,
  MILLING_LINES,
  OPERATORS,
  RENDEMEN_TARGET,
  estimateOutputs,
  lotAvailable,
  type Batch,
  type MillingLine,
  type NewBatch,
} from '@/features/produksi/produksi-data'

type BatchFormDrawerProps = {
  nextId: string
  batches: Batch[]
  onClose: () => void
  onSave: (data: NewBatch, start: boolean) => void
}

type FormErrors = Partial<Record<'lotId' | 'inputKg' | 'date' | 'operator', string>>

export function BatchFormDrawer({ nextId, batches, onClose, onSave }: BatchFormDrawerProps) {
  const lots = GRAIN_LOTS.map((lot) => ({ lot, available: lotAvailable(lot.id, batches) })).filter(
    (x) => x.available > 0,
  )

  const [lotId, setLotId] = useState('')
  const [inputKg, setInputKg] = useState('')
  const [date, setDate] = useState(todayIso())
  // Pilih lini yang sedang kosong lebih dulu
  const [line, setLine] = useState<MillingLine>(
    () => MILLING_LINES.find((l) => !batches.some((b) => b.status === 'proses' && b.line === l)) ?? MILLING_LINES[0],
  )
  const [operator, setOperator] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const available = lots.find((x) => x.lot.id === lotId)?.available ?? 0
  const input = parseNumber(inputKg)
  const estimate = estimateOutputs(input)

  function submit(start: boolean) {
    const next: FormErrors = {}
    if (!lotId) next.lotId = 'Pilih lot gabah'
    if (input <= 0) next.inputKg = 'Isi berat gabah yang digiling'
    else if (lotId && input > available) next.inputKg = `Melebihi stok lot (${formatKg(available)})`
    if (!date) next.date = 'Tanggal wajib diisi'
    if (!operator) next.operator = 'Pilih operator'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave({ lotId, inputKg: input, date, line, operator, note: note.trim() || undefined }, start)
  }

  return (
    <DrawerShell
      open
      eyebrow="Batch produksi baru"
      title={nextId}
      onClose={onClose}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        submit(true)
      }}
      footer={
        <>
          <div className="mb-3 rounded-xl bg-surface px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] text-muted">Perkiraan beras (target ≥ {RENDEMEN_TARGET}%)</p>
              <p className="tabular-nums text-[15px] font-semibold text-ink">
                {input > 0 ? `± ${formatKg(estimate.berasKepala + estimate.berasPatah)}` : '—'}
              </p>
            </div>
            {input > 0 ? (
              <div className="mt-2">
                <MassBalance inputKg={input} outputs={estimate} compact />
              </div>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted">Isi berat gabah untuk melihat perkiraan hasil.</p>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => submit(false)} className={secondaryBtn}>
              Simpan rencana
            </button>
            <button type="submit" className={primaryBtn}>
              Simpan & mulai giling
            </button>
          </div>
        </>
      }
    >
      <fieldset className="space-y-4">
        <legend className={[sectionLabel, 'mb-3'].join(' ')}>01 · Bahan baku</legend>
        <div>
          <Select
            label="Lot gabah (GKG)"
            requiredMark
            value={lotId}
            placeholder="Pilih lot dari gudang"
            options={lots.map(({ lot, available: kg }) => ({
              value: lot.id,
              label: `${lot.id} · ${formatKg(kg)} tersedia`,
              description: `${lot.supplier} · ${lot.source} · masuk ${formatDate(lot.receivedAt)}`,
            }))}
            onChange={(v) => {
              setLotId(v)
              setErrors((e) => ({ ...e, lotId: undefined, inputKg: undefined }))
            }}
          />
          {errors.lotId ? <p className="mt-1.5 text-xs text-red-600">{errors.lotId}</p> : null}
        </div>
        <TextField
          id="bt-input"
          label="Berat gabah digiling (kg)"
          requiredMark
          inputMode="decimal"
          placeholder="0"
          value={inputKg}
          onChange={(e) => {
            setInputKg(e.target.value)
            setErrors((er) => ({ ...er, inputKg: undefined }))
          }}
          error={errors.inputKg}
          trailing={
            lotId ? (
              <button
                type="button"
                onClick={() => setInputKg(String(available))}
                className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-brand-800 hover:bg-brand-100"
              >
                Semua {formatKg(available)}
              </button>
            ) : null
          }
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={[sectionLabel, 'mb-3'].join(' ')}>02 · Jadwal & lini giling</legend>
        <TextField
          id="bt-date"
          label="Tanggal giling"
          type="date"
          requiredMark
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
        />
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Lini giling</span>
          <div role="radiogroup" aria-label="Lini giling" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
            {MILLING_LINES.map((l) => {
              const busy = batches.some((b) => b.status === 'proses' && b.line === l)
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={line === l}
                  onClick={() => setLine(l)}
                  className={[
                    'flex h-10 flex-col items-center justify-center rounded-lg text-[13px] font-medium transition',
                    line === l ? 'bg-panel text-brand-900 shadow-sm' : 'text-muted hover:text-ink',
                  ].join(' ')}
                >
                  {l}
                  <span className={['text-[10px] font-normal', busy ? 'text-amber-700' : 'text-muted'].join(' ')}>
                    {busy ? 'sedang dipakai' : 'kosong'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <Select
            label="Operator"
            requiredMark
            value={operator}
            placeholder="Pilih operator mesin"
            options={OPERATORS.map((o) => ({ value: o, label: o }))}
            onChange={(v) => {
              setOperator(v)
              setErrors((e) => ({ ...e, operator: undefined }))
            }}
          />
          {errors.operator ? <p className="mt-1.5 text-xs text-red-600">{errors.operator}</p> : null}
        </div>
        <TextField
          id="bt-note"
          label="Catatan"
          placeholder="Opsional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </fieldset>
    </DrawerShell>
  )
}
