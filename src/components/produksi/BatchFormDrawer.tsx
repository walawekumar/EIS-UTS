import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  primaryBtn,
  secondaryBtn,
  sectionLabel,
} from '@/components/pembelian/Toolbar'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import { useMasterStore } from '@/features/master/master-store'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import { isPurchaseReceivedForAp } from '@/features/pembelian/pembelian-data'
import {
  DEFAULT_OUTPUT_TEMPLATE,
  PRODUKSI_LOCATIONS,
  todayIso,
  type BatchLine,
  type NewBatchInput,
} from '@/features/produksi/produksi-data'

type Props = {
  open: boolean
  nextId: string
  onClose: () => void
  onSave: (data: NewBatchInput) => void
}

type FormState = {
  date: string
  operator: string
  inputSku: string
  inputQty: string
  inputLotId: string
  fromLocation: string
  processLocation: string
  toLocation: string
  targetRendemen: string
  note: string
  outputs: BatchLine[]
}

export function BatchFormDrawer({ open, nextId, onClose, onSave }: Props) {
  const { user } = useAuth()
  const { products } = useMasterStore()
  const { purchases } = usePembelian()
  const gabah = products.filter((p) => p.active && p.category === 'gabah')
  const lots = purchases.filter(
    (p) => isPurchaseReceivedForAp(p.stage) && !p.voidedAt && p.lotId,
  )
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  function emptyForm(): FormState {
    const g = gabah[0]
    return {
      date: todayIso(),
      operator: user?.name ?? 'Operator Produksi',
      inputSku: g?.sku ?? 'GBH-IR64',
      inputQty: '',
      inputLotId: '',
      fromLocation: 'Silo 1',
      processLocation: 'Lantai Produksi',
      toLocation: 'Gudang A',
      targetRendemen: '65',
      note: '',
      outputs: DEFAULT_OUTPUT_TEMPLATE.map((o) => ({ ...o })),
    }
  }

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setError(null)
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('[role="listbox"]')) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  function setOutputQty(index: number, qty: string) {
    setForm((f) => {
      const outputs = f.outputs.map((o, i) =>
        i === index
          ? { ...o, qty: Math.max(0, Number(qty.replace(/[^\d.]/g, '')) || 0) }
          : o,
      )
      return { ...f, outputs }
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const inputQty = Math.max(0, Number(form.inputQty.replace(/[^\d.]/g, '')) || 0)
    if (inputQty <= 0) {
      setError('Qty input gabah wajib > 0')
      return
    }
    if (!form.outputs.some((o) => o.qty > 0)) {
      setError('Isi minimal satu qty output (rencana)')
      return
    }
    const product = gabah.find((p) => p.sku === form.inputSku) ?? gabah[0]
    onSave({
      date: form.date,
      operator: form.operator.trim() || 'Operator',
      inputSku: form.inputSku,
      inputName: product?.name ?? form.inputSku,
      inputUnit: product?.unit ?? 'kg',
      inputQty,
      inputLotId: form.inputLotId || undefined,
      fromLocation: form.fromLocation,
      processLocation: form.processLocation,
      toLocation: form.toLocation,
      outputs: form.outputs,
      targetRendemen: Math.max(
        0,
        Number(form.targetRendemen.replace(/[^\d.]/g, '')) || 65,
      ),
      note: form.note.trim(),
    })
  }

  const locOpts = PRODUKSI_LOCATIONS.map((l) => ({ value: l, label: l }))

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Tutup"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-panel shadow-xl"
      >
        <header className="border-b border-line px-5 py-4">
          <p className={sectionLabel}>Batch baru</p>
          <h2 className="mt-1 text-[17px] font-semibold text-ink">{nextId}</h2>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="bat-date"
              label="Tanggal"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              requiredMark
            />
            <TextField
              id="bat-op"
              label="Operator"
              value={form.operator}
              onChange={(e) =>
                setForm((f) => ({ ...f, operator: e.target.value }))
              }
            />
            <Select
              label="Input gabah"
              value={form.inputSku}
              options={gabah.map((p) => ({
                value: p.sku,
                label: p.name,
                description: p.sku,
              }))}
              onChange={(inputSku) => setForm((f) => ({ ...f, inputSku }))}
              requiredMark
            />
            <Select
              label="Lot gabah (opsional)"
              value={form.inputLotId || '__none__'}
              options={[
                { value: '__none__', label: 'Tanpa lot' },
                ...lots.map((p) => ({
                  value: p.lotId!,
                  label: p.lotId!,
                  description: `${p.id} · ${p.grain}`,
                })),
              ]}
              onChange={(inputLotId) => {
                if (inputLotId === '__none__') {
                  setForm((f) => ({ ...f, inputLotId: '' }))
                  return
                }
                const lot = lots.find((p) => p.lotId === inputLotId)
                setForm((f) => ({
                  ...f,
                  inputLotId,
                  inputQty: lot
                    ? String(
                        // approx from estimated or leave
                        f.inputQty || lot.estimatedKg,
                      )
                    : f.inputQty,
                }))
              }}
            />
            <TextField
              id="bat-qty"
              label="Qty input (kg)"
              value={form.inputQty}
              inputMode="decimal"
              placeholder="Contoh: 5000"
              onChange={(e) =>
                setForm((f) => ({ ...f, inputQty: e.target.value }))
              }
              requiredMark
            />
            <Select
              label="Dari gudang"
              value={form.fromLocation}
              options={locOpts}
              onChange={(fromLocation) =>
                setForm((f) => ({ ...f, fromLocation }))
              }
            />
            <Select
              label="Lokasi proses"
              value={form.processLocation}
              options={locOpts}
              onChange={(processLocation) =>
                setForm((f) => ({ ...f, processLocation }))
              }
            />
            <Select
              label="Gudang hasil"
              value={form.toLocation}
              options={locOpts}
              onChange={(toLocation) => setForm((f) => ({ ...f, toLocation }))}
            />
            <TextField
              id="bat-target"
              label="Target rendemen (%)"
              value={form.targetRendemen}
              inputMode="decimal"
              onChange={(e) =>
                setForm((f) => ({ ...f, targetRendemen: e.target.value }))
              }
            />
          </div>

          <div>
            <p className={sectionLabel}>Rencana output</p>
            <div className="mt-2 space-y-2">
              {form.outputs.map((line, index) => (
                <div
                  key={line.sku}
                  className="grid grid-cols-[1fr_100px] items-end gap-2"
                >
                  <TextField
                    id={`out-name-${line.sku}`}
                    label={line.productName}
                    value={line.sku}
                    readOnly
                  />
                  <TextField
                    id={`out-qty-${line.sku}`}
                    label="Qty"
                    value={line.qty ? String(line.qty) : ''}
                    inputMode="decimal"
                    onChange={(e) => setOutputQty(index, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <TextField
            id="bat-note"
            label="Catatan"
            value={form.note}
            placeholder="Opsional"
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>

        <footer className="flex gap-2 border-t border-line px-5 py-4">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Batal
          </button>
          <button type="submit" className={`${primaryBtn} flex-1`}>
            Simpan draft
          </button>
        </footer>
      </form>
    </div>
  )
}
