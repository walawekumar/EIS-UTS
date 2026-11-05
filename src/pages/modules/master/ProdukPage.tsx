import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  FinanceModal,
  ModalActions,
  TextAreaField,
} from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import {
  FinanceEmptyRow,
  FinanceSortTh,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
  rowNumber,
  sortBy,
  toggleSort,
  type SortState,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { printBukti } from '@/components/keuangan/print-bukti'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import {
  PRODUCT_CATEGORY_LABEL,
  UNIT_OPTIONS,
  buildProdukStats,
  formatIdr,
  type MasterProduct,
  type ProductCategory,
} from '@/features/master/master-data'
import {
  sanitizeBarcode,
  sanitizeMoney,
  sanitizeMultiline,
  sanitizeSku,
  sanitizeText,
  validateProductForm,
  type ProductFieldErrors,
} from '@/features/master/input-safety'
import { useMasterStore } from '@/features/master/master-store'
import { usePageSize } from '@/features/settings/usePageSize'

type SortKey = 'sku' | 'name' | 'category' | 'unit' | 'defaultPrice' | 'active'
type CatFilter = 'all' | ProductCategory
type StatusFilter = 'all' | 'active' | 'inactive'

type FormState = {
  sku: string
  name: string
  unit: string
  category: ProductCategory
  barcode: string
  defaultPrice: string
  costPrice: string
  minQty: string
  taxable: boolean
  active: boolean
  note: string
}

const emptyForm = (): FormState => ({
  sku: '',
  name: '',
  unit: 'kg',
  category: 'beras',
  barcode: '',
  defaultPrice: '',
  costPrice: '',
  minQty: '',
  taxable: false,
  active: true,
  note: '',
})

export function ProdukPage() {
  const {
    products,
    upsertProduct,
    setProductActive,
    removeProduct,
  } = useMasterStore()
  const PAGE_SIZE = usePageSize()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CatFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'name',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<MasterProduct | null>(null)
  const [editing, setEditing] = useState<MasterProduct | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<ProductFieldErrors>({})
  const [toast, setToast] = useState<string | null>(null)

  const stats = useMemo(() => buildProdukStats(products), [products])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => setPage(1), [search, category, status])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (status === 'active' && !p.active) return false
      if (status === 'inactive' && p.active) return false
      if (!q) return true
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      sku: (r) => r.sku,
      name: (r) => r.name,
      category: (r) => r.category,
      unit: (r) => r.unit,
      defaultPrice: (r) => r.defaultPrice,
      active: (r) => (r.active ? 1 : 0),
    })
  }, [products, search, category, status, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
    setFormOpen(true)
  }

  function openEdit(row: MasterProduct) {
    setEditing(row)
    setForm({
      sku: row.sku,
      name: row.name,
      unit: row.unit,
      category: row.category,
      barcode: row.barcode,
      defaultPrice: String(row.defaultPrice),
      costPrice: String(row.costPrice),
      minQty: String(row.minQty),
      taxable: row.taxable,
      active: row.active,
      note: row.note,
    })
    setFormErrors({})
    setFormOpen(true)
    setDetail(null)
  }

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setFormErrors((e) => ({ ...e, [key]: undefined }))
  }

  function saveForm() {
    const nextErrors = validateProductForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setToast('Periksa kembali isian yang belum valid')
      return
    }
    const sku = sanitizeSku(form.sku)
    const dup = products.find(
      (p) => p.sku.toUpperCase() === sku && p.id !== editing?.id,
    )
    if (dup) {
      setToast('SKU sudah dipakai produk lain')
      return
    }
    upsertProduct(
      {
        sku,
        name: sanitizeText(form.name, 120).trim(),
        unit: form.unit,
        category: form.category,
        barcode: sanitizeBarcode(form.barcode),
        defaultPrice: Math.max(0, Number(sanitizeMoney(form.defaultPrice)) || 0),
        costPrice: Math.max(0, Number(sanitizeMoney(form.costPrice)) || 0),
        minQty: Math.max(0, Number(sanitizeMoney(form.minQty, 8)) || 0),
        taxable: form.taxable,
        active: form.active,
        note: sanitizeMultiline(form.note, 300).trim(),
      },
      editing?.id,
    )
    setFormOpen(false)
    setFormErrors({})
    setToast(editing ? 'Produk diperbarui' : 'Produk ditambahkan')
  }

  function handlePrint(row: MasterProduct) {
    printBukti(
      row.name,
      [
        { label: 'SKU', value: row.sku },
        { label: 'Barcode', value: row.barcode || ',' },
        { label: 'Kategori', value: PRODUCT_CATEGORY_LABEL[row.category] },
        { label: 'Satuan', value: row.unit },
        { label: 'Harga jual', value: formatIdr(row.defaultPrice) },
        { label: 'Harga beli', value: formatIdr(row.costPrice) },
        { label: 'Stok min', value: String(row.minQty) },
        { label: 'Kena pajak', value: row.taxable ? 'Ya' : 'Tidak' },
        { label: 'Status', value: row.active ? 'Aktif' : 'Nonaktif' },
        { label: 'Catatan', value: row.note || ',' },
      ],
      { subtitle: 'Kartu produk', module: 'Master Data · Produk' },
    )
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />
      <FinanceToast message={toast} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Produk & satuan</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Katalog gabah, beras, dan sampingan
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="h-10 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900"
          >
            + Produk
          </button>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari SKU, barcode, atau nama…"
          filter={category}
          filterLabel="Kategori"
          filterOptions={[
            { value: 'all', label: 'Semua kategori' },
            { value: 'gabah', label: 'Gabah' },
            { value: 'beras', label: 'Beras' },
            { value: 'sampingan', label: 'Sampingan' },
          ]}
          onFilterChange={setCategory}
          secondaryFilter={status}
          secondaryFilterLabel="Status"
          secondaryFilterOptions={[
            { value: 'all', label: 'Semua status' },
            { value: 'active', label: 'Aktif' },
            { value: 'inactive', label: 'Nonaktif' },
          ]}
          onSecondaryFilterChange={setStatus}
        />

        <FinanceTable>
          <FinanceThead>
            <FinanceTh className="w-10">#</FinanceTh>
            <FinanceSortTh
              label="SKU"
              sortKey="sku"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Nama"
              sortKey="name"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Kategori"
              sortKey="category"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Satuan"
              sortKey="unit"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Harga jual"
              sortKey="defaultPrice"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Status"
              sortKey="active"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Tidak ada data." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {row.sku}
                  </FinanceTd>
                  <FinanceTd>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{row.name}</p>
                      {row.barcode ? (
                        <p className="truncate text-[11px] text-muted">
                          {row.barcode}
                        </p>
                      ) : null}
                    </div>
                  </FinanceTd>
                  <FinanceTd>{PRODUCT_CATEGORY_LABEL[row.category]}</FinanceTd>
                  <FinanceTd>{row.unit}</FinanceTd>
                  <FinanceTd mono>{formatIdr(row.defaultPrice)}</FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={row.active ? 'Aktif' : 'Nonaktif'}
                      tone={row.active ? 'good' : 'muted'}
                    />
                  </FinanceTd>
                  <FinanceTd align="center">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                      aria-label={`Detail ${row.sku}`}
                    >
                      <EyeIcon className="size-[18px]" />
                    </button>
                  </FinanceTd>
                </FinanceTr>
              ))
            )}
          </tbody>
        </FinanceTable>

        <FinancePager
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </section>

      {detail ? (
        <DetailDrawer
          open
          onClose={() => setDetail(null)}
          title={detail.name}
          subtitle={detail.sku}
          badge={
            <StatusPill
              label={PRODUCT_CATEGORY_LABEL[detail.category]}
              tone="neutral"
            />
          }
          footer={
            <>
              <button
                type="button"
                onClick={() => handlePrint(detail)}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Cetak kartu
              </button>
              <button
                type="button"
                onClick={() => openEdit(detail)}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductActive(detail.id, !detail.active)
                  setDetail({ ...detail, active: !detail.active })
                  setToast(detail.active ? 'Produk nonaktif' : 'Produk aktif')
                }}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                {detail.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  removeProduct(detail.id)
                  setDetail(null)
                  setToast('Produk dihapus')
                }}
                className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
              >
                Hapus
              </button>
            </>
          }
        >
          <DrawerHero
            label="Harga jual"
            amount={formatIdr(detail.defaultPrice)}
            hint={`per ${detail.unit}`}
          />
          <DrawerSection label="Spesifikasi">
            <DrawerFacts
              items={[
                ['SKU', detail.sku],
                ['Barcode', detail.barcode || ','],
                ['Kategori', PRODUCT_CATEGORY_LABEL[detail.category]],
                ['Satuan', detail.unit],
                ['Harga beli', formatIdr(detail.costPrice)],
                ['Stok minimum', String(detail.minQty)],
                ['Kena pajak', detail.taxable ? 'Ya' : 'Tidak'],
                ['Status', detail.active ? 'Aktif' : 'Nonaktif'],
              ]}
            />
          </DrawerSection>
          {detail.note ? (
            <DrawerSection label="Catatan">
              <p className="text-[13px] text-muted">{detail.note}</p>
            </DrawerSection>
          ) : null}
        </DetailDrawer>
      ) : null}

      {formOpen ? (
        <FinanceModal
          title={editing ? 'Edit produk' : 'Tambah produk'}
          subtitle={editing?.sku ?? 'SKU baru'}
          onClose={() => setFormOpen(false)}
          wide
          footer={
            <ModalActions
              onCancel={() => setFormOpen(false)}
              onConfirm={saveForm}
              confirmLabel="Simpan"
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="prd-sku"
              label="SKU"
              requiredMark
              value={form.sku}
              placeholder="Contoh: BRS-PREM"
              maxLength={32}
              error={formErrors.sku}
              onChange={(e) => patchForm('sku', sanitizeSku(e.target.value))}
            />
            <TextField
              id="prd-name"
              label="Nama"
              requiredMark
              value={form.name}
              placeholder="Contoh: Beras Premium 25kg"
              maxLength={120}
              error={formErrors.name}
              onChange={(e) =>
                patchForm('name', sanitizeText(e.target.value, 120))
              }
            />
            <Select
              label="Kategori"
              value={form.category}
              options={(
                Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]
              ).map((c) => ({
                value: c,
                label: PRODUCT_CATEGORY_LABEL[c],
              }))}
              onChange={(category) => patchForm('category', category)}
            />
            <Select
              label="Satuan"
              value={form.unit}
              options={[...UNIT_OPTIONS]}
              onChange={(unit) => patchForm('unit', unit)}
            />
            <TextField
              id="prd-barcode"
              label="Barcode"
              value={form.barcode}
              placeholder="8–14 digit (opsional)"
              inputMode="numeric"
              maxLength={14}
              error={formErrors.barcode}
              onChange={(e) =>
                patchForm('barcode', sanitizeBarcode(e.target.value))
              }
            />
            <TextField
              id="prd-min"
              label="Stok minimum"
              value={form.minQty}
              placeholder="Peringatan stok rendah"
              inputMode="numeric"
              maxLength={8}
              error={formErrors.minQty}
              onChange={(e) =>
                patchForm('minQty', sanitizeMoney(e.target.value, 8))
              }
            />
            <TextField
              id="prd-price"
              label="Harga jual default (Rp)"
              value={form.defaultPrice}
              placeholder="Harga jual acuan"
              inputMode="numeric"
              maxLength={15}
              error={formErrors.defaultPrice}
              onChange={(e) =>
                patchForm('defaultPrice', sanitizeMoney(e.target.value))
              }
            />
            <TextField
              id="prd-cost"
              label="Harga beli / HPP (Rp)"
              value={form.costPrice}
              placeholder="Biaya per satuan"
              inputMode="numeric"
              maxLength={15}
              error={formErrors.costPrice}
              onChange={(e) =>
                patchForm('costPrice', sanitizeMoney(e.target.value))
              }
            />
            <div className="flex items-end pb-1">
              <Switch
                id="prd-taxable"
                label="Kena pajak (PPN)"
                checked={form.taxable}
                onChange={(taxable) => patchForm('taxable', taxable)}
              />
            </div>
            <div className="flex items-end pb-1">
              <Switch
                id="prd-active"
                label="Aktif"
                checked={form.active}
                onChange={(active) => patchForm('active', active)}
              />
            </div>
          </div>
          <TextAreaField
            id="prd-note"
            label="Catatan"
            value={form.note}
            placeholder="Catatan internal produk"
            error={formErrors.note}
            onChange={(note) =>
              patchForm('note', sanitizeMultiline(note, 300))
            }
            rows={2}
          />
        </FinanceModal>
      ) : null}
    </div>
  )
}
