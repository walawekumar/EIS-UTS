import { useEffect, useState, type FormEvent } from 'react'
import { SideOverlay } from '@/components/ops/SideOverlay'
import { primaryBtn, secondaryBtn, sectionLabel } from '@/components/pembelian/Toolbar'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useMasterStore } from '@/features/master/master-store'
import {
  formatQty,
  formatRupiah,
  parseNumber,
  todayIso,
  type NewSaleOrder,
} from '@/features/penjualan/penjualan-data'

type OrderFormDrawerProps = {
  open: boolean
  nextId: string
  onClose: () => void
  onSave: (order: NewSaleOrder) => void
  error?: string | null
}

type FormState = {
  customerId: string
  sku: string
  date: string
  qty: string
  price: string
  note: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

export function OrderFormDrawer({
  open,
  nextId,
  onClose,
  onSave,
  error,
}: OrderFormDrawerProps) {
  const { customers, products } = useMasterStore()
  const saleProducts = products.filter(
    (p) => p.active && (p.category === 'beras' || p.category === 'sampingan'),
  )
  const customerOptions = customers
    .filter((c) => c.active)
    .map((c) => ({
      value: c.id,
      label: c.name,
      description: c.area,
    }))
  const productOptions = saleProducts.map((p) => ({
    value: p.sku,
    label: p.name,
    description: `${p.sku} · ${p.unit}`,
  }))

  function emptyForm(): FormState {
    const product = saleProducts[0]
    return {
      customerId: '',
      sku: product?.sku ?? '',
      date: todayIso(),
      qty: '',
      price: String(product?.defaultPrice ?? 0),
      note: '',
    }
  }

  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setErrors({})
  }, [open])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function changeSku(sku: string) {
    const product = saleProducts.find((p) => p.sku === sku)
    setForm((f) => ({
      ...f,
      sku,
      price:
        product &&
        f.price ===
          String(saleProducts.find((p) => p.sku === f.sku)?.defaultPrice)
          ? String(product.defaultPrice)
          : f.price,
    }))
  }

  const product = saleProducts.find((p) => p.sku === form.sku) ?? saleProducts[0]
  const qty = parseNumber(form.qty)
  const price = parseNumber(form.price)
  const total = Math.round(qty * price)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: FormErrors = {}
    if (!form.customerId) next.customerId = 'Pilih pelanggan'
    if (!product) next.sku = 'Pilih produk'
    if (!form.date) next.date = 'Tanggal wajib diisi'
    if (qty <= 0) next.qty = 'Isi jumlah'
    if (price <= 0) next.price = 'Isi harga'
    setErrors(next)
    if (Object.keys(next).length > 0 || !product) return

    onSave({
      customerId: form.customerId,
      sku: product.sku,
      productName: product.name,
      unit: product.unit,
      date: form.date,
      qty,
      price,
      note: form.note.trim() || undefined,
    })
  }

return (
    <SideOverlay open={open} onClose={onClose} labelledBy="so-form-title">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className={sectionLabel}>Order baru</p>
          <h2
            id="so-form-title"
            className="num mt-1 text-[16px] font-semibold text-ink"
          >
            {nextId}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-muted transition hover:bg-surface hover:text-ink"
          aria-label="Tutup"
        >
          ✕
        </button>
      </header>

      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-brand flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <Select
            label="Pelanggan"
            value={form.customerId}
            options={customerOptions}
            onChange={(v) => set('customerId', v)}
            requiredMark
            placeholder="Pilih pelanggan"
          />
          {errors.customerId ? (
            <p className="-mt-2 text-[12px] text-red-700">{errors.customerId}</p>
          ) : null}
          <TextField
            id="so-date"
            label="Tanggal"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            error={errors.date}
          />
          <Select
            label="Produk"
            value={form.sku}
            options={productOptions}
            onChange={changeSku}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="so-qty"
              label={`Jumlah (${product?.unit ?? 'unit'})`}
              requiredMark
              inputMode="decimal"
              value={form.qty}
              onChange={(e) => set('qty', e.target.value)}
              error={errors.qty}
            />
            <TextField
              id="so-price"
              label="Harga"
              requiredMark
              inputMode="numeric"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              error={errors.price}
            />
          </div>
          <TextField
            id="so-note"
            label="Catatan"
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Opsional"
          />
          <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px]">
            <div className="flex justify-between gap-2">
              <span className="text-muted">Qty</span>
              <span className="num text-ink">
                {qty > 0 ? formatQty(qty, product.unit) : ','}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-muted">Nilai order</span>
              <span className="num font-semibold text-ink">
                {qty > 0 && price > 0 ? formatRupiah(total) : ','}
              </span>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-line px-5 py-4">
          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
            >
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
          <button type="button" onClick={onClose} className={[secondaryBtn, 'flex-1'].join(' ')}>
            Batal
          </button>
          <button type="submit" className={[primaryBtn, 'flex-1'].join(' ')}>
            Simpan order
          </button>
          </div>
        </footer>
      </form>
    </SideOverlay>
  )
}
