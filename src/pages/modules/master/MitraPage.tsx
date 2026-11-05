import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import {
  CUSTOMER_GROUP_OPTIONS,
  PARTNER_KIND_LABEL,
  PAYMENT_METHOD_PREF_LABEL,
  SUPPLIER_GROUP_OPTIONS,
  buildMitraStats,
  formatIdr,
  type MasterPartner,
  type PartnerKind,
  type PaymentMethodPref,
} from '@/features/master/master-data'
import {
  sanitizeDigits,
  sanitizeEmail,
  sanitizeMoney,
  sanitizeMultiline,
  sanitizeNpwp,
  sanitizePhone,
  sanitizeText,
  validatePartnerForm,
  type PartnerFieldErrors,
} from '@/features/master/input-safety'
import { useMasterStore } from '@/features/master/master-store'
import { usePageSize } from '@/features/settings/usePageSize'

type SortKey = 'kind' | 'name' | 'group' | 'area' | 'phone' | 'paymentTermDays' | 'active'
type KindFilter = 'all' | PartnerKind
type StatusFilter = 'all' | 'active' | 'inactive'

type FormState = {
  kind: PartnerKind
  name: string
  legalName: string
  group: string
  area: string
  postalCode: string
  phone: string
  email: string
  address: string
  contactName: string
  contactPhone: string
  npwp: string
  pkp: boolean
  bankName: string
  bankAccount: string
  bankHolder: string
  paymentMethod: PaymentMethodPref
  paymentTermDays: string
  creditLimit: string
  active: boolean
  note: string
}

function defaultGroup(kind: PartnerKind) {
  return kind === 'supplier' ? 'Petani' : 'Retail'
}

const emptyForm = (): FormState => ({
  kind: 'supplier',
  name: '',
  legalName: '',
  group: 'Petani',
  area: '',
  postalCode: '',
  phone: '',
  email: '',
  address: '',
  contactName: '',
  contactPhone: '',
  npwp: '',
  pkp: false,
  bankName: '',
  bankAccount: '',
  bankHolder: '',
  paymentMethod: 'transfer',
  paymentTermDays: '7',
  creditLimit: '',
  active: true,
  note: '',
})

function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title}
      </p>
      {children}
    </div>
  )
}

export function MitraPage() {
  const {
    suppliers,
    customers,
    upsertPartner,
    setPartnerActive,
    removePartner,
  } = useMasterStore()
  const PAGE_SIZE = usePageSize()

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'name',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<MasterPartner | null>(null)
  const [editing, setEditing] = useState<MasterPartner | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<PartnerFieldErrors>({})
  const [toast, setToast] = useState<string | null>(null)

  const partners = useMemo(
    () => [...suppliers, ...customers],
    [suppliers, customers],
  )
  const stats = useMemo(() => buildMitraStats(partners), [partners])

  const groupOptions = useMemo(() => {
    const kind = editing?.kind ?? form.kind
    return kind === 'supplier'
      ? [...SUPPLIER_GROUP_OPTIONS]
      : [...CUSTOMER_GROUP_OPTIONS]
  }, [editing?.kind, form.kind])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    setPage(1)
  }, [search, kindFilter, status])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = partners.filter((p) => {
      if (kindFilter !== 'all' && p.kind !== kindFilter) return false
      if (status === 'active' && !p.active) return false
      if (status === 'inactive' && p.active) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.legalName.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.contactName.toLowerCase().includes(q) ||
        p.npwp.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        PARTNER_KIND_LABEL[p.kind].toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      kind: (r) => r.kind,
      name: (r) => r.name,
      group: (r) => r.group,
      area: (r) => r.area,
      phone: (r) => r.phone,
      paymentTermDays: (r) => r.paymentTermDays,
      active: (r) => (r.active ? 1 : 0),
    })
  }, [partners, search, kindFilter, status, sort])

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

  function openEdit(row: MasterPartner) {
    setEditing(row)
    setForm({
      kind: row.kind,
      name: row.name,
      legalName: row.legalName,
      group: row.group,
      area: row.area,
      postalCode: row.postalCode,
      phone: row.phone,
      email: row.email,
      address: row.address,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      npwp: row.npwp,
      pkp: row.pkp,
      bankName: row.bankName,
      bankAccount: row.bankAccount,
      bankHolder: row.bankHolder,
      paymentMethod: row.paymentMethod,
      paymentTermDays: String(row.paymentTermDays),
      creditLimit: row.creditLimit ? String(row.creditLimit) : '',
      active: row.active,
      note: row.note,
    })
    setFormErrors({})
    setFormOpen(true)
    setDetail(null)
  }

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      if (key === 'kind') {
        const kind = value as PartnerKind
        return {
          ...f,
          kind,
          group: defaultGroup(kind),
          creditLimit: kind === 'customer' ? f.creditLimit : '',
        }
      }
      return { ...f, [key]: value }
    })
    setFormErrors((e) => ({ ...e, [key]: undefined }))
  }

  function saveForm() {
    const nextErrors = validatePartnerForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setToast('Periksa kembali isian yang belum valid')
      return
    }

    const kind = editing?.kind ?? form.kind
    const name = sanitizeText(form.name, 120).trim()
    const id = upsertPartner(
      kind,
      {
        name,
        legalName: sanitizeText(form.legalName, 120).trim() || name,
        group: sanitizeText(form.group, 40).trim() || defaultGroup(kind),
        area: sanitizeText(form.area, 80).trim() || '',
        postalCode: sanitizeDigits(form.postalCode, 5),
        phone: sanitizePhone(form.phone).trim(),
        email: sanitizeEmail(form.email).trim().toLowerCase(),
        address: sanitizeMultiline(form.address, 300).trim(),
        contactName: sanitizeText(form.contactName, 80).trim(),
        contactPhone: sanitizePhone(form.contactPhone).trim(),
        npwp: sanitizeNpwp(form.npwp).trim(),
        pkp: form.pkp,
        bankName: sanitizeText(form.bankName, 60).trim(),
        bankAccount: sanitizeText(form.bankAccount, 32).trim(),
        bankHolder: sanitizeText(form.bankHolder, 80).trim(),
        paymentMethod: form.paymentMethod,
        paymentTermDays: Math.min(
          365,
          Math.max(0, Number(sanitizeDigits(form.paymentTermDays, 3)) || 0),
        ),
        creditLimit:
          kind === 'customer'
            ? Math.max(0, Number(sanitizeMoney(form.creditLimit)) || 0)
            : 0,
        active: form.active,
        note: sanitizeMultiline(form.note, 300).trim(),
      },
      editing?.id,
    )
    setFormOpen(false)
    setFormErrors({})
    setToast(
      editing
        ? `${PARTNER_KIND_LABEL[kind]} diperbarui`
        : `${PARTNER_KIND_LABEL[kind]} ${id} ditambahkan`,
    )
  }

  function handlePrint(row: MasterPartner) {
    printBukti(
      row.name,
      [
        { label: 'Jenis', value: PARTNER_KIND_LABEL[row.kind] },
        { label: 'ID', value: row.id },
        { label: 'Nama legal', value: row.legalName || ',' },
        { label: 'Segmen', value: row.group || ',' },
        { label: 'Area', value: row.area },
        { label: 'Kode pos', value: row.postalCode || ',' },
        { label: 'Telepon', value: row.phone || ',' },
        { label: 'Email', value: row.email || ',' },
        { label: 'PIC', value: row.contactName || ',' },
        { label: 'Telp PIC', value: row.contactPhone || ',' },
        { label: 'NPWP', value: row.npwp || ',' },
        { label: 'PKP', value: row.pkp ? 'Ya' : 'Tidak' },
        { label: 'Bank', value: row.bankName || ',' },
        { label: 'Rekening', value: row.bankAccount || ',' },
        { label: 'Atas nama', value: row.bankHolder || ',' },
        {
          label: 'Metode bayar',
          value: PAYMENT_METHOD_PREF_LABEL[row.paymentMethod],
        },
        { label: 'Tempo', value: `${row.paymentTermDays} hari` },
        ...(row.kind === 'customer'
          ? [
              {
                label: 'Limit kredit',
                value: row.creditLimit ? formatIdr(row.creditLimit) : 'Tidak dibatasi',
              },
            ]
          : []),
        { label: 'Alamat', value: row.address || ',' },
        { label: 'Status', value: row.active ? 'Aktif' : 'Nonaktif' },
        { label: 'Catatan', value: row.note || ',' },
      ],
      { subtitle: 'Kartu mitra', module: 'Master Data · Mitra' },
    )
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />
      <FinanceToast message={toast} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Pemasok & pelanggan
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Data acuan untuk pembelian dan penjualan
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="h-10 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900"
          >
            + Mitra
          </button>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nama, PIC, NPWP, area…"
          filter={kindFilter}
          filterLabel="Jenis"
          filterOptions={[
            { value: 'all', label: 'Semua jenis' },
            { value: 'supplier', label: 'Pemasok' },
            { value: 'customer', label: 'Pelanggan' },
          ]}
          onFilterChange={setKindFilter}
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
              label="Jenis"
              sortKey="kind"
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
              label="Segmen"
              sortKey="group"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Area"
              sortKey="area"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Telepon"
              sortKey="phone"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Tempo"
              sortKey="paymentTermDays"
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
              <FinanceEmptyRow colSpan={9} message="Tidak ada data." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={PARTNER_KIND_LABEL[row.kind]}
                      tone={row.kind === 'supplier' ? 'neutral' : 'good'}
                    />
                  </FinanceTd>
                  <FinanceTd>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{row.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        {row.contactName
                          ? `PIC: ${row.contactName}`
                          : row.id}
                      </p>
                    </div>
                  </FinanceTd>
                  <FinanceTd>{row.group || ','}</FinanceTd>
                  <FinanceTd>{row.area}</FinanceTd>
                  <FinanceTd mono>{row.phone || ','}</FinanceTd>
                  <FinanceTd mono>{row.paymentTermDays}h</FinanceTd>
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
                      aria-label={`Detail ${row.name}`}
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
          subtitle={detail.id}
          badge={
            <StatusPill
              label={PARTNER_KIND_LABEL[detail.kind]}
              tone={detail.kind === 'supplier' ? 'neutral' : 'good'}
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
                  setPartnerActive(detail.kind, detail.id, !detail.active)
                  setDetail({ ...detail, active: !detail.active })
                  setToast(
                    detail.active ? 'Ditandai nonaktif' : 'Diaktifkan kembali',
                  )
                }}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                {detail.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  removePartner(detail.kind, detail.id)
                  setDetail(null)
                  setToast('Mitra dihapus')
                }}
                className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
              >
                Hapus
              </button>
            </>
          }
        >
          <DrawerSection label="Identitas">
            <DrawerFacts
              items={[
                ['Jenis', PARTNER_KIND_LABEL[detail.kind]],
                ['Nama legal', detail.legalName || ','],
                ['Segmen', detail.group || ','],
                ['Area', detail.area],
                ['Kode pos', detail.postalCode || ','],
                ['Status', detail.active ? 'Aktif' : 'Nonaktif'],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Kontak">
            <DrawerFacts
              items={[
                ['Telepon', detail.phone || ','],
                ['Email', detail.email || ','],
                ['PIC', detail.contactName || ','],
                ['Telp PIC', detail.contactPhone || ','],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Pajak & pembayaran">
            <DrawerFacts
              items={[
                ['NPWP', detail.npwp || ','],
                ['PKP', detail.pkp ? 'Ya' : 'Tidak'],
                [
                  'Metode bayar',
                  PAYMENT_METHOD_PREF_LABEL[detail.paymentMethod],
                ],
                ['Tempo bayar', `${detail.paymentTermDays} hari`],
                ...(detail.kind === 'customer'
                  ? ([
                      [
                        'Limit kredit',
                        detail.creditLimit
                          ? formatIdr(detail.creditLimit)
                          : 'Tidak dibatasi',
                      ],
                    ] as [string, string][])
                  : []),
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Rekening bank">
            <DrawerFacts
              items={[
                ['Bank', detail.bankName || ','],
                ['No. rekening', detail.bankAccount || ','],
                ['Atas nama', detail.bankHolder || ','],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Alamat">
            <p className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5 text-[13px] text-ink">
              {detail.address || ','}
            </p>
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
          title={editing ? 'Edit mitra' : 'Tambah mitra'}
          subtitle={editing?.id ?? 'Pemasok atau pelanggan'}
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
          <div className="space-y-5">
            <FormSection title="Identitas">
              <div className="grid gap-3 sm:grid-cols-2">
                {editing ? (
                  <TextField
                    id="mitra-kind"
                    label="Jenis"
                    value={PARTNER_KIND_LABEL[editing.kind]}
                    readOnly
                  />
                ) : (
                  <Select
                    label="Jenis"
                    value={form.kind}
                    options={[
                      {
                        value: 'supplier',
                        label: 'Pemasok',
                        description: 'Sumber gabah / pembelian',
                      },
                      {
                        value: 'customer',
                        label: 'Pelanggan',
                        description: 'Pembeli beras / penjualan',
                      },
                    ]}
                    onChange={(kind) => patchForm('kind', kind)}
                    requiredMark
                  />
                )}
                <Select
                  label="Segmen / kelompok"
                  value={form.group}
                  options={groupOptions.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  onChange={(group) => patchForm('group', group)}
                  requiredMark
                />
                <TextField
                  id="mitra-name"
                  label="Nama tampilan"
                  requiredMark
                  value={form.name}
                  placeholder={
                    form.kind === 'supplier'
                      ? 'Contoh: Kelompok Tani Sri Rejeki'
                      : 'Contoh: Toko Beras Makmur'
                  }
                  maxLength={120}
                  autoComplete="organization"
                  error={formErrors.name}
                  onChange={(e) =>
                    patchForm('name', sanitizeText(e.target.value, 120))
                  }
                />
                <TextField
                  id="mitra-legal"
                  label="Nama legal / sesuai NPWP"
                  value={form.legalName}
                  placeholder="Kosongkan jika sama dengan nama tampilan"
                  maxLength={120}
                  error={formErrors.legalName}
                  onChange={(e) =>
                    patchForm('legalName', sanitizeText(e.target.value, 120))
                  }
                />
                <TextField
                  id="mitra-area"
                  label={
                    form.kind === 'supplier' ? 'Desa / kecamatan' : 'Kota'
                  }
                  value={form.area}
                  placeholder={
                    form.kind === 'supplier'
                      ? 'Contoh: Desa Ngawen / Kec. Gondang'
                      : 'Contoh: Solo, Klaten, Yogyakarta'
                  }
                  maxLength={80}
                  error={formErrors.area}
                  onChange={(e) =>
                    patchForm('area', sanitizeText(e.target.value, 80))
                  }
                />
                <TextField
                  id="mitra-postal"
                  label="Kode pos"
                  value={form.postalCode}
                  placeholder="5 digit, contoh: 57413"
                  inputMode="numeric"
                  maxLength={5}
                  error={formErrors.postalCode}
                  onChange={(e) =>
                    patchForm('postalCode', sanitizeDigits(e.target.value, 5))
                  }
                />
              </div>
            </FormSection>

            <FormSection title="Kontak">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="mitra-phone"
                  label="Telepon / WhatsApp"
                  value={form.phone}
                  placeholder="08xx-xxxx-xxxx atau +62…"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={20}
                  error={formErrors.phone}
                  onChange={(e) =>
                    patchForm('phone', sanitizePhone(e.target.value))
                  }
                />
                <TextField
                  id="mitra-email"
                  label="Email"
                  type="email"
                  value={form.email}
                  placeholder="nama@domain.com (opsional)"
                  autoComplete="email"
                  maxLength={120}
                  error={formErrors.email}
                  onChange={(e) =>
                    patchForm('email', sanitizeEmail(e.target.value))
                  }
                />
                <TextField
                  id="mitra-pic"
                  label="Nama PIC / kontak"
                  value={form.contactName}
                  placeholder="Orang yang dihubungi untuk order / bayar"
                  maxLength={80}
                  error={formErrors.contactName}
                  onChange={(e) =>
                    patchForm('contactName', sanitizeText(e.target.value, 80))
                  }
                />
                <TextField
                  id="mitra-pic-phone"
                  label="Telepon PIC"
                  value={form.contactPhone}
                  placeholder="Opsional jika beda dari telepon utama"
                  inputMode="tel"
                  maxLength={20}
                  error={formErrors.contactPhone}
                  onChange={(e) =>
                    patchForm('contactPhone', sanitizePhone(e.target.value))
                  }
                />
              </div>
            </FormSection>

            <FormSection title="Pajak">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="mitra-npwp"
                  label="NPWP"
                  value={form.npwp}
                  placeholder="10.20.0.1-000.000"
                  inputMode="numeric"
                  maxLength={20}
                  error={formErrors.npwp}
                  onChange={(e) =>
                    patchForm('npwp', sanitizeNpwp(e.target.value))
                  }
                />
                <div className="flex items-end pb-1">
                  <Switch
                    id="mitra-pkp"
                    label="Pengusaha Kena Pajak (PKP)"
                    checked={form.pkp}
                    onChange={(pkp) => patchForm('pkp', pkp)}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Pembayaran & bank">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Metode bayar preferensi"
                  value={form.paymentMethod}
                  options={(
                    Object.keys(
                      PAYMENT_METHOD_PREF_LABEL,
                    ) as PaymentMethodPref[]
                  ).map((value) => ({
                    value,
                    label: PAYMENT_METHOD_PREF_LABEL[value],
                  }))}
                  onChange={(paymentMethod) =>
                    patchForm('paymentMethod', paymentMethod)
                  }
                />
                <TextField
                  id="mitra-term"
                  label="Tempo bayar (hari)"
                  value={form.paymentTermDays}
                  placeholder="0 = tunai · 7 / 14 / 30"
                  inputMode="numeric"
                  maxLength={3}
                  error={formErrors.paymentTermDays}
                  onChange={(e) =>
                    patchForm(
                      'paymentTermDays',
                      sanitizeDigits(e.target.value, 3),
                    )
                  }
                />
                {(editing?.kind ?? form.kind) === 'customer' ? (
                  <TextField
                    id="mitra-credit"
                    label="Limit kredit (Rp)"
                    value={form.creditLimit}
                    placeholder="0 = tidak dibatasi"
                    inputMode="numeric"
                    maxLength={15}
                    error={formErrors.creditLimit}
                    onChange={(e) =>
                      patchForm('creditLimit', sanitizeMoney(e.target.value))
                    }
                  />
                ) : null}
                <TextField
                  id="mitra-bank"
                  label="Bank"
                  value={form.bankName}
                  placeholder="BRI / BCA / Mandiri / Bank Jateng…"
                  maxLength={60}
                  error={formErrors.bankName}
                  onChange={(e) =>
                    patchForm('bankName', sanitizeText(e.target.value, 60))
                  }
                />
                <TextField
                  id="mitra-rek"
                  label="No. rekening"
                  value={form.bankAccount}
                  placeholder="Nomor rekening untuk transfer"
                  maxLength={32}
                  error={formErrors.bankAccount}
                  onChange={(e) =>
                    patchForm('bankAccount', sanitizeText(e.target.value, 32))
                  }
                />
                <TextField
                  id="mitra-holder"
                  label="Atas nama rekening"
                  value={form.bankHolder}
                  placeholder="Sesuai buku tabungan / rekening koran"
                  maxLength={80}
                  error={formErrors.bankHolder}
                  onChange={(e) =>
                    patchForm('bankHolder', sanitizeText(e.target.value, 80))
                  }
                />
                <div className="flex items-end pb-1 sm:col-span-2">
                  <Switch
                    id="mitra-active"
                    label="Aktif (tampil di form transaksi)"
                    checked={form.active}
                    onChange={(active) => patchForm('active', active)}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Alamat & catatan">
              <TextAreaField
                id="mitra-address"
                label="Alamat"
                value={form.address}
                placeholder="Alamat lengkap untuk surat jalan / tagihan"
                error={formErrors.address}
                onChange={(address) =>
                  patchForm('address', sanitizeMultiline(address, 300))
                }
                rows={2}
              />
              <TextAreaField
                id="mitra-note"
                label="Catatan"
                value={form.note}
                placeholder="Catatan internal, mis. prefer COD atau jadwal kirim"
                error={formErrors.note}
                onChange={(note) =>
                  patchForm('note', sanitizeMultiline(note, 300))
                }
                rows={2}
              />
            </FormSection>
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}
