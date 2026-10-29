import { useState } from 'react'
import { StageLabel } from '@/components/pembelian/StatusLabel'
import {
  EmptyState,
  panelClass,
  primaryBtn,
  secondaryBtn,
  sectionLabel,
} from '@/components/pembelian/Toolbar'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import {
  GRAIN_STANDARD,
  TARA_PER_SACK,
  VARIANCE_TOLERANCE,
  calcWeighing,
  formatDate,
  formatKg,
  formatNumber,
  formatPercent,
  formatRupiah,
  getSupplier,
  parseNumber,
  type Purchase,
  type WeighingInput,
} from '@/features/pembelian/pembelian-data'

type PenerimaanViewProps = {
  purchases: Purchase[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSaveWeighing: (id: string, input: WeighingInput) => void
  onConfirm: (id: string, input: WeighingInput) => void
  onGoTo: (tab: 'pembayaran', id: string) => void
}

export function PenerimaanView({
  purchases,
  selectedId,
  onSelect,
  onSaveWeighing,
  onConfirm,
  onGoTo,
}: PenerimaanViewProps) {
  const waiting = purchases.filter((p) => p.stage === 'dicatat')
  const weighed = purchases.filter((p) => p.stage === 'ditimbang')
  const recent = purchases
    .filter((p) => p.stage === 'diterima' && p.weighing?.confirmedAt)
    .sort((a, b) => (b.weighing?.confirmedAt ?? '').localeCompare(a.weighing?.confirmedAt ?? ''))
    .slice(0, 4)

  const pool = [...weighed, ...waiting, ...recent]
  const selected = pool.find((p) => p.id === selectedId) ?? pool[0] ?? null

  return (
    <div className="grid items-start gap-2.5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className={[panelClass, 'p-4'].join(' ')}>
        <QueueGroup
          title="Menunggu konfirmasi berat"
          hint="Sudah ditimbang, perlu disetujui"
          items={weighed}
          selectedId={selected?.id}
          onSelect={onSelect}
        />
        <QueueGroup
          title="Antre timbang"
          hint="Gabah datang, belum ditimbang"
          items={waiting}
          selectedId={selected?.id}
          onSelect={onSelect}
        />
        <QueueGroup
          title="Baru dikonfirmasi"
          items={recent}
          selectedId={selected?.id}
          onSelect={onSelect}
          compact
        />
      </aside>

      <section className={[panelClass, 'p-4 sm:p-5'].join(' ')}>
        {selected ? (
          <WeighingPanel
            key={selected.id}
            purchase={selected}
            onSave={(input) => onSaveWeighing(selected.id, input)}
            onConfirm={(input) => onConfirm(selected.id, input)}
            onGoToPayment={() => onGoTo('pembayaran', selected.id)}
          />
        ) : (
          <EmptyState
            title="Tidak ada gabah yang perlu ditimbang"
            hint="Catat pembelian baru dulu di halaman Pencatatan pembelian."
          />
        )}
      </section>
    </div>
  )
}

function QueueGroup({
  title,
  hint,
  items,
  selectedId,
  onSelect,
  compact = false,
}: {
  title: string
  hint?: string
  items: Purchase[]
  selectedId?: string
  onSelect: (id: string) => void
  compact?: boolean
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
        <p className={sectionLabel}>{title}</p>
        <span className="num text-[11px] text-muted">{items.length}</span>
      </div>
      {hint && items.length === 0 ? <p className="py-2 text-[12px] text-muted">Kosong — {hint.toLowerCase()}.</p> : null}
      <ul className="space-y-1.5">
        {items.map((p) => {
          const supplier = getSupplier(p.supplierId)
          const active = p.id === selectedId
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={[
                  'w-full rounded-xl border px-3 text-left transition',
                  compact ? 'py-2' : 'py-2.5',
                  active
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-line hover:border-brand-200 hover:bg-surface',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={['num text-[12px]', active ? 'font-semibold text-brand-900' : 'text-ink'].join(' ')}>
                    {p.id}
                  </span>
                  <span className="num text-[11px] text-muted">{formatDate(p.date)}</span>
                </div>
                <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{supplier?.name}</p>
                {!compact ? (
                  <p className="num mt-0.5 truncate text-[11px] text-muted">
                    {p.grain} · {p.sacks} karung · ± {formatKg(p.estimatedKg)}
                    {p.vehicle ? ` · ${p.vehicle}` : ''}
                  </p>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type FormState = Record<keyof WeighingInput, string>
type FormErrors = Partial<Record<keyof WeighingInput, string>>

function WeighingPanel({
  purchase: p,
  onSave,
  onConfirm,
  onGoToPayment,
}: {
  purchase: Purchase
  onSave: (input: WeighingInput) => void
  onConfirm: (input: WeighingInput) => void
  onGoToPayment: () => void
}) {
  const supplier = getSupplier(p.supplierId)
  const std = GRAIN_STANDARD[p.grain]
  const locked = p.stage === 'diterima'

  const [form, setForm] = useState<FormState>(() => ({
    bruto: p.weighing ? String(p.weighing.bruto) : '',
    tara: String(p.weighing?.tara ?? p.sacks * TARA_PER_SACK),
    moisture: p.weighing ? String(p.weighing.moisture).replace('.', ',') : '',
    impurity: p.weighing ? String(p.weighing.impurity).replace('.', ',') : '',
  }))
  const [errors, setErrors] = useState<FormErrors>({})
  const [agreed, setAgreed] = useState(false)
  const [saved, setSaved] = useState(false)

  const input: WeighingInput = {
    bruto: parseNumber(form.bruto),
    tara: parseNumber(form.tara),
    moisture: parseNumber(form.moisture),
    impurity: parseNumber(form.impurity),
  }
  const calc = calcWeighing(p.grain, input)
  const hasBruto = input.bruto > 0
  const variance = hasBruto ? calc.weighed - p.estimatedKg : 0
  const variancePct = p.estimatedKg > 0 ? (variance / p.estimatedKg) * 100 : 0
  const varianceWarn = hasBruto && Math.abs(variancePct) > VARIANCE_TOLERANCE

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setSaved(false)
  }

  function validate(): boolean {
    const next: FormErrors = {}
    if (input.bruto <= 0) next.bruto = 'Isi berat bruto'
    if (input.tara < 0) next.tara = 'Tidak boleh negatif'
    else if (input.bruto > 0 && input.tara >= input.bruto) next.tara = 'Harus lebih kecil dari bruto'
    if (input.moisture <= 0 || input.moisture > 40) next.moisture = 'Antara 0–40%'
    if (input.impurity < 0 || input.impurity > 30) next.impurity = 'Antara 0–30%'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className={sectionLabel}>Penerimaan & timbang</p>
          <h2 className="mt-1 text-[15px] font-semibold text-ink">
            <span className="num">{p.id}</span>
            <span className="mx-1.5 text-line">/</span>
            {supplier?.name}
          </h2>
          <p className="num mt-0.5 text-[12px] text-muted">
            {p.grain} · {std.label} · {p.sacks} karung · taksiran {formatKg(p.estimatedKg)} · {formatRupiah(p.price)}/kg
            {p.vehicle ? ` · ${p.vehicle}` : ''}
          </p>
        </div>
        <StageLabel stage={p.stage} />
      </div>

      {locked ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5">
          <p className="text-[12px] text-brand-900">
            Berat dikonfirmasi pada{' '}
            <span className="font-semibold">
              {p.weighing?.confirmedAt ? formatDate(p.weighing.confirmedAt, { day: 'numeric', month: 'long' }) : '—'}
            </span>
            {p.dueDate ? (
              <>
                {' '}· jatuh tempo bayar{' '}
                <span className="font-semibold">{formatDate(p.dueDate, { day: 'numeric', month: 'long' })}</span>
              </>
            ) : null}
          </p>
          <button type="button" onClick={onGoToPayment} className="text-[12px] font-semibold text-brand-800 hover:underline">
            Lihat pembayaran →
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <fieldset disabled={locked} className="min-w-0">
          <legend className={[sectionLabel, 'mb-3'].join(' ')}>Hasil timbangan</legend>
          <div className="grid grid-cols-2 gap-3.5">
            <TextField
              id="pn-bruto"
              label="Berat bruto (kg)"
              requiredMark
              inputMode="decimal"
              placeholder="0"
              value={form.bruto}
              onChange={(e) => set('bruto', e.target.value)}
              error={errors.bruto}
            />
            <TextField
              id="pn-tara"
              label="Tara karung (kg)"
              inputMode="decimal"
              value={form.tara}
              onChange={(e) => set('tara', e.target.value)}
              error={errors.tara}
            />
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            Tara bawaan {TARA_PER_SACK} kg × {p.sacks} karung
          </p>

          <p className={[sectionLabel, 'mt-5 mb-3'].join(' ')}>Uji mutu</p>
          <div className="grid grid-cols-2 gap-3.5">
            <TextField
              id="pn-moisture"
              label="Kadar air (%)"
              requiredMark
              inputMode="decimal"
              placeholder={`maks ${std.moisture}`}
              value={form.moisture}
              onChange={(e) => set('moisture', e.target.value)}
              error={errors.moisture}
            />
            <TextField
              id="pn-impurity"
              label="Hampa/kotoran (%)"
              requiredMark
              inputMode="decimal"
              placeholder={`maks ${std.impurity}`}
              value={form.impurity}
              onChange={(e) => set('impurity', e.target.value)}
              error={errors.impurity}
            />
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            Standar {p.grain}: kadar air ≤ {std.moisture}%, hampa ≤ {std.impurity}%. Kelebihannya jadi rafaksi.
          </p>
        </fieldset>

        <div className="min-w-0 rounded-2xl bg-surface p-4">
          <p className={[sectionLabel, 'mb-2'].join(' ')}>Perhitungan berat</p>
          <dl className="space-y-1.5 text-[13px]">
            <CalcRow label="Berat bruto" value={formatKg(input.bruto)} />
            <CalcRow label="Tara karung" value={`− ${formatKg(input.tara)}`} muted />
            <div className="border-t border-line pt-1.5">
              <CalcRow label="Berat timbang" value={formatKg(calc.weighed)} strong />
            </div>
            <CalcRow
              label={`Kadar air lebih ${formatPercent(calc.moistureCut)}`}
              value={calc.moistureCut > 0 ? `− ${formatKg(Math.round((calc.weighed * calc.moistureCut) / 100))}` : '—'}
              warn={calc.moistureCut > 0}
              muted={calc.moistureCut === 0}
            />
            <CalcRow
              label={`Hampa lebih ${formatPercent(calc.impurityCut)}`}
              value={calc.impurityCut > 0 ? `− ${formatKg(Math.round((calc.weighed * calc.impurityCut) / 100))}` : '—'}
              warn={calc.impurityCut > 0}
              muted={calc.impurityCut === 0}
            />
          </dl>

          <div className="mt-3 rounded-xl border border-line bg-panel px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium text-muted">Berat netto diterima</span>
              <span className="num text-[22px] leading-none font-semibold tracking-tight text-ink">
                {formatNumber(calc.netto)}
                <span className="ml-1 text-[12px] font-normal text-muted">kg</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
              <span className="text-[12px] text-muted">Nilai pembelian</span>
              <span className="num text-[14px] font-semibold text-brand-800">{formatRupiah(calc.netto * p.price)}</span>
            </div>
          </div>

          {hasBruto ? (
            <p
              className={[
                'mt-2.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px]',
                varianceWarn ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800',
              ].join(' ')}
            >
              Selisih vs taksiran: {variance >= 0 ? '+' : '−'}
              {formatKg(Math.abs(variance))} ({variance >= 0 ? '+' : '−'}
              {formatPercent(Math.abs(variancePct))})
              {varianceWarn ? ` · di atas toleransi ${VARIANCE_TOLERANCE}%, cek ulang timbangan` : ' · wajar'}
            </p>
          ) : null}
        </div>
      </div>

      {!locked ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          {p.stage === 'ditimbang' ? (
            <div className="sm:min-w-[300px]">
              <Switch
                id="pn-agree"
                label="Pemasok menyetujui berat netto"
                checked={agreed}
                onChange={setAgreed}
              />
            </div>
          ) : (
            <p className="text-[12px] text-muted">
              {saved ? 'Tersimpan. Lanjutkan konfirmasi berat dengan pemasok.' : 'Simpan hasil timbang, lalu konfirmasi bersama pemasok.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {p.stage === 'dicatat' ? (
              <button
                type="button"
                className={primaryBtn}
                onClick={() => {
                  if (validate()) {
                    onSave(input)
                    setSaved(true)
                  }
                }}
              >
                Simpan hasil timbang
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => {
                    if (validate()) {
                      onSave(input)
                      setSaved(true)
                    }
                  }}
                >
                  {saved ? 'Tersimpan ✓' : 'Perbarui timbangan'}
                </button>
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={!agreed}
                  title={agreed ? undefined : 'Aktifkan persetujuan pemasok dulu'}
                  onClick={() => {
                    if (validate()) onConfirm(input)
                  }}
                >
                  Konfirmasi berat & terima gabah
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CalcRow({
  label,
  value,
  strong,
  muted,
  warn,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? 'text-muted' : 'text-ink'}>{label}</dt>
      <dd
        className={[
          'num text-right',
          strong ? 'font-semibold text-ink' : warn ? 'text-amber-700' : muted ? 'text-muted' : 'text-ink',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}
