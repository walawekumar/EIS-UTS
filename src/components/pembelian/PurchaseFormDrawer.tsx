import { useEffect, useRef, useState, type FormEvent } from 'react'
import { primaryBtn, secondaryBtn, sectionLabel } from '@/components/pembelian/Toolbar'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import {
  DEFAULT_PRICE,
  GRAIN_STANDARD,
  formatKg,
  formatRupiah,
  parseNumber,
  todayIso,
  type GrainType,
  type NewPurchase,
} from '@/features/pembelian/pembelian-data'
import { useMasterStore } from '@/features/master/master-store'

type PurchaseFormDrawerProps = {
  open: boolean
  nextId: string
  onClose: () => void
  onSave: (purchase: NewPurchase) => void
}

type FormState = {
  supplierId: string
  grain: GrainType
  date: string
  sacks: string
  estimatedKg: string
  price: string
  vehicle: string
  note: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

function emptyForm(): FormState {
  return {
    supplierId: '',
    grain: 'GKP',
    date: todayIso(),
    sacks: '',
    estimatedKg: '',
    price: String(DEFAULT_PRICE.GKP),
    vehicle: '',
    note: '',
  }
}

const GRAIN_OPTIONS = (Object.keys(GRAIN_STANDARD) as GrainType[]).map((g) => ({
  value: g,
  label: `${g} — ${GRAIN_STANDARD[g].label}`,
  description: `Maks kadar air ${GRAIN_STANDARD[g].moisture}% · hampa ${GRAIN_STANDARD[g].impurity}%`,
}))

export function PurchaseFormDrawer({ open, nextId, onClose, onSave }: PurchaseFormDrawerProps) {
  const { suppliers } = useMasterStore()
  const supplierOptions = suppliers
    .filter((s) => s.active)
    .map((s) => ({
      value: s.id,
      label: s.name,
      description: s.area,
    }))
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setErrors({})

    function onEscape(event: KeyboardEvent) {
      // Select menutup dirinya sendiri lebih dulu
      if (event.key === 'Escape' && !document.querySelector('[role="listbox"]')) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open])

  if (!open) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function changeGrain(grain: GrainType) {
    setForm((f) => ({
      ...f,
      grain,
      // Ganti harga default hanya jika belum diubah manual
      price: f.price === String(DEFAULT_PRICE[f.grain]) ? String(DEFAULT_PRICE[grain]) : f.price,
    }))
  }

  const sacks = parseNumber(form.sacks)
  const estimatedKg = parseNumber(form.estimatedKg)
  const price = parseNumber(form.price)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: FormErrors = {}
    if (!form.supplierId) next.supplierId = 'Pilih pemasok'
    if (!form.date) next.date = 'Tanggal wajib diisi'
    if (sacks <= 0 || !Number.isInteger(sacks)) next.sacks = 'Isi jumlah karung'
    if (estimatedKg <= 0) next.estimatedKg = 'Isi taksiran berat'
    if (price <= 0) next.price = 'Isi harga per kg'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    onSave({
      supplierId: form.supplierId,
      grain: form.grain,
      date: form.date,
      sacks,
      estimatedKg,
      price,
      vehicle: form.vehicle.trim() || undefined,
      note: form.note.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="pb-form-title">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 backdrop-blur-[1px]"
      />

      <form
        onSubmit={onSubmit}
        noValidate
        className="relative m-0 flex h-full w-full max-w-[440px] flex-col bg-panel shadow-[0_0_48px_rgba(20,32,25,0.18)] sm:m-2 sm:h-[calc(100%-1rem)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className={sectionLabel}>Catat pembelian gabah</p>
            <h2 id="pb-form-title" className="num mt-1 text-[15px] font-semibold text-ink">
              {nextId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
            aria-label="Tutup form"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="scrollbar-brand flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <fieldset className="space-y-4">
            <legend className={[sectionLabel, 'mb-3'].join(' ')}>01 · Pemasok & gabah</legend>
            <div>
              <Select
                label="Pemasok"
                requiredMark
                value={form.supplierId}
                options={supplierOptions}
                onChange={(v) => set('supplierId', v)}
                placeholder="Pilih pemasok gabah"
              />
              {errors.supplierId ? <p className="mt-1.5 text-xs text-red-600">{errors.supplierId}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Jenis gabah" value={form.grain} options={GRAIN_OPTIONS} onChange={changeGrain} />
              <TextField
                id="pb-date"
                label="Tanggal"
                type="date"
                requiredMark
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                error={errors.date}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className={[sectionLabel, 'mb-3'].join(' ')}>02 · Taksiran & harga sepakat</legend>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="pb-sacks"
                label="Jumlah karung"
                requiredMark
                inputMode="numeric"
                placeholder="0"
                value={form.sacks}
                onChange={(e) => set('sacks', e.target.value)}
                error={errors.sacks}
              />
              <TextField
                id="pb-estimate"
                label="Taksiran berat (kg)"
                requiredMark
                inputMode="decimal"
                placeholder="0"
                value={form.estimatedKg}
                onChange={(e) => set('estimatedKg', e.target.value)}
                error={errors.estimatedKg}
              />
            </div>
            <TextField
              id="pb-price"
              label="Harga sepakat per kg netto (Rp)"
              requiredMark
              inputMode="numeric"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              error={errors.price}
            />
            <p className="font-mono text-[11px] leading-relaxed text-muted">
              Berat pasti dan rafaksi ditentukan saat penimbangan di halaman Penerimaan.
            </p>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className={[sectionLabel, 'mb-3'].join(' ')}>03 · Pengiriman</legend>
            <TextField
              id="pb-vehicle"
              label="No. polisi kendaraan"
              placeholder="Opsional, mis. AD 1234 XY"
              value={form.vehicle}
              onChange={(e) => set('vehicle', e.target.value)}
            />
            <TextField
              id="pb-note"
              label="Catatan"
              placeholder="Opsional"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </fieldset>
        </div>

        <footer className="border-t border-line px-5 py-4">
          <div className="mb-3 flex items-baseline justify-between gap-3 rounded-xl bg-surface px-3.5 py-2.5">
            <div>
              <p className="text-[11px] text-muted">Nilai taksiran</p>
              <p className="num text-[11px] text-muted">
                {formatKg(estimatedKg)} × {formatRupiah(price)}
              </p>
            </div>
            <p className="num text-[16px] font-semibold text-ink">{formatRupiah(estimatedKg * price)}</p>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={onClose} className={secondaryBtn}>
              Batal
            </button>
            <button type="submit" className={primaryBtn}>
              Simpan catatan pembelian
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
