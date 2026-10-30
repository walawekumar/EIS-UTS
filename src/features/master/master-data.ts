import { ROLE_LABELS, type UserRole } from '@/types/auth'

export type PartnerKind = 'supplier' | 'customer'
export type PaymentMethodPref = 'tunai' | 'transfer' | 'campuran'

export type MasterPartner = {
  id: string
  kind: PartnerKind
  name: string
  /** Nama legal / sesuai NPWP */
  legalName: string
  /** Segmen: Petani, Koperasi, Retail, Distributor… */
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
  paymentTermDays: number
  /** Limit kredit pelanggan (Rp); 0 = tidak dibatasi / tidak dipakai */
  creditLimit: number
  active: boolean
  note: string
}

export type ProductCategory = 'gabah' | 'beras' | 'sampingan'

export type MasterProduct = {
  id: string
  sku: string
  name: string
  unit: string
  category: ProductCategory
  barcode: string
  defaultPrice: number
  costPrice: number
  minQty: number
  taxable: boolean
  active: boolean
  note: string
}

export type MasterUser = {
  id: string
  name: string
  email: string
  role: UserRole
  title: string
  phone: string
  branch: string
  department: string
  active: boolean
}

export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = {
  supplier: 'Pemasok',
  customer: 'Pelanggan',
}

export const PAYMENT_METHOD_PREF_LABEL: Record<PaymentMethodPref, string> = {
  tunai: 'Tunai / COD',
  transfer: 'Transfer bank',
  campuran: 'Campuran',
}

export const SUPPLIER_GROUP_OPTIONS = [
  { value: 'Petani', label: 'Petani / perorangan' },
  { value: 'Kelompok tani', label: 'Kelompok tani' },
  { value: 'Koperasi', label: 'Koperasi' },
  { value: 'UD / CV', label: 'UD / CV pemasok' },
] as const

export const CUSTOMER_GROUP_OPTIONS = [
  { value: 'Retail', label: 'Retail / warung' },
  { value: 'Toko', label: 'Toko beras' },
  { value: 'Distributor', label: 'Distributor' },
  { value: 'Pasar', label: 'Pasar induk' },
  { value: 'Institusi', label: 'Institusi / kontrak' },
] as const

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  gabah: 'Gabah',
  beras: 'Beras',
  sampingan: 'Sampingan',
}

export const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'sak', label: 'Sak / karung' },
  { value: 'ton', label: 'Ton' },
] as const

function partner(
  partial: Omit<MasterPartner, 'legalName' | 'group' | 'postalCode' | 'contactName' | 'contactPhone' | 'npwp' | 'pkp' | 'bankName' | 'bankAccount' | 'bankHolder' | 'paymentMethod' | 'creditLimit'> &
    Partial<
      Pick<
        MasterPartner,
        | 'legalName'
        | 'group'
        | 'postalCode'
        | 'contactName'
        | 'contactPhone'
        | 'npwp'
        | 'pkp'
        | 'bankName'
        | 'bankAccount'
        | 'bankHolder'
        | 'paymentMethod'
        | 'creditLimit'
      >
    >,
): MasterPartner {
  return {
    ...partial,
    legalName: partial.legalName ?? partial.name,
    group:
      partial.group ??
      (partial.kind === 'supplier' ? 'Petani' : 'Retail'),
    postalCode: partial.postalCode ?? '',
    contactName: partial.contactName ?? '',
    contactPhone: partial.contactPhone ?? '',
    npwp: partial.npwp ?? '',
    pkp: partial.pkp ?? false,
    bankName: partial.bankName ?? '',
    bankAccount: partial.bankAccount ?? '',
    bankHolder: partial.bankHolder ?? '',
    paymentMethod: partial.paymentMethod ?? 'transfer',
    creditLimit: partial.creditLimit ?? 0,
  }
}

export function normalizePartner(
  raw: Partial<MasterPartner> & Pick<MasterPartner, 'id' | 'kind' | 'name'>,
): MasterPartner {
  return partner({
    id: raw.id,
    kind: raw.kind,
    name: raw.name,
    legalName: raw.legalName,
    group: raw.group,
    area: raw.area ?? '—',
    postalCode: raw.postalCode,
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    address: raw.address ?? '',
    contactName: raw.contactName,
    contactPhone: raw.contactPhone,
    npwp: raw.npwp,
    pkp: raw.pkp,
    bankName: raw.bankName,
    bankAccount: raw.bankAccount,
    bankHolder: raw.bankHolder,
    paymentMethod: raw.paymentMethod,
    paymentTermDays: raw.paymentTermDays ?? 7,
    creditLimit: raw.creditLimit,
    active: raw.active ?? true,
    note: raw.note ?? '',
  })
}

export function normalizeProduct(
  raw: Partial<MasterProduct> & Pick<MasterProduct, 'id' | 'sku' | 'name'>,
): MasterProduct {
  return {
    id: raw.id,
    sku: raw.sku,
    name: raw.name,
    unit: raw.unit ?? 'kg',
    category: raw.category ?? 'beras',
    barcode: raw.barcode ?? '',
    defaultPrice: raw.defaultPrice ?? 0,
    costPrice: raw.costPrice ?? 0,
    minQty: raw.minQty ?? 0,
    taxable: raw.taxable ?? false,
    active: raw.active ?? true,
    note: raw.note ?? '',
  }
}

export function normalizeUser(
  raw: Partial<MasterUser> & Pick<MasterUser, 'id' | 'name' | 'email' | 'role'>,
): MasterUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    title: raw.title ?? ROLE_LABELS[raw.role],
    phone: raw.phone ?? '',
    branch: raw.branch ?? 'Mill Klaten',
    department: raw.department ?? ROLE_LABELS[raw.role],
    active: raw.active ?? true,
  }
}

export const SEED_SUPPLIERS: MasterPartner[] = [
  partner({
    id: 'sup-01',
    kind: 'supplier',
    name: 'Kelompok Tani Sri Rejeki',
    group: 'Kelompok tani',
    area: 'Desa Ngawen',
    postalCode: '57413',
    phone: '0812-3400-1101',
    email: 'sri.rejeki@tani.id',
    address: 'Dusun Krajan RT 02/01',
    contactName: 'Pak Slamet',
    contactPhone: '0812-3400-1101',
    npwp: '',
    paymentMethod: 'transfer',
    paymentTermDays: 7,
    bankName: 'BRI',
    bankAccount: '0123-01-445566-53-2',
    bankHolder: 'Kelompok Tani Sri Rejeki',
    active: true,
    note: 'Mitra panen rutin musim kemarau',
  }),
  partner({
    id: 'sup-02',
    kind: 'supplier',
    name: 'Pak Darmo',
    group: 'Petani',
    area: 'Desa Sukamaju',
    phone: '0813-2211-4455',
    email: '',
    address: 'Jl. Sawah Barat No. 8',
    contactName: 'Pak Darmo',
    paymentMethod: 'tunai',
    paymentTermDays: 7,
    active: true,
    note: '',
  }),
  partner({
    id: 'sup-03',
    kind: 'supplier',
    name: 'UD Tani Makmur',
    legalName: 'UD Tani Makmur',
    group: 'UD / CV',
    area: 'Kec. Karanganyar',
    phone: '0272-441-220',
    email: 'admin@tanimakmur.id',
    address: 'Jl. Raya Karanganyar Km 3',
    contactName: 'Bu Rina',
    contactPhone: '0812-7788-9900',
    npwp: '10.0.0.1-412.000',
    pkp: true,
    paymentMethod: 'transfer',
    paymentTermDays: 14,
    bankName: 'BCA',
    bankAccount: '7788990011',
    bankHolder: 'UD Tani Makmur',
    active: true,
    note: 'Sering kirim GKG',
  }),
  partner({
    id: 'sup-04',
    kind: 'supplier',
    name: 'Bu Suminah',
    group: 'Petani',
    area: 'Desa Tegalsari',
    phone: '0857-9900-2211',
    email: '',
    address: 'Tegalsari RT 04',
    contactName: 'Bu Suminah',
    paymentMethod: 'tunai',
    paymentTermDays: 0,
    active: true,
    note: 'Prefer bayar tunai',
  }),
  partner({
    id: 'sup-05',
    kind: 'supplier',
    name: 'Koperasi Tani Sejahtera',
    group: 'Koperasi',
    area: 'Kec. Gondang',
    phone: '0272-555-018',
    email: 'koperasi@sejahtera.id',
    address: 'Komplek Pasar Gondang',
    contactName: 'Pak Hadi',
    npwp: '10.0.1.3-412.000',
    pkp: true,
    paymentMethod: 'transfer',
    paymentTermDays: 7,
    bankName: 'Bank Jateng',
    bankAccount: '3-012-00456-1',
    bankHolder: 'Koperasi Tani Sejahtera',
    active: true,
    note: '',
  }),
]

export const SEED_CUSTOMERS: MasterPartner[] = [
  partner({
    id: 'cus-01',
    kind: 'customer',
    name: 'Toko Beras Makmur',
    group: 'Toko',
    area: 'Solo',
    postalCode: '57131',
    phone: '0271-712-330',
    email: 'order@berasmakmur.id',
    address: 'Jl. Slamet Riyadi No. 45',
    contactName: 'Mas Andi',
    contactPhone: '0812-5555-0101',
    npwp: '10.20.0.3-501.000',
    pkp: true,
    paymentMethod: 'transfer',
    paymentTermDays: 7,
    creditLimit: 50_000_000,
    bankName: 'BRI',
    bankAccount: '0123-01-998877-53-2',
    bankHolder: 'Toko Beras Makmur',
    active: true,
    note: 'Order beras premium rutin',
  }),
  partner({
    id: 'cus-02',
    kind: 'customer',
    name: 'UD Sumber Rejeki',
    group: 'Distributor',
    area: 'Klaten',
    phone: '0272-330-112',
    email: 'ud.sumber@mail.id',
    address: 'Pasar Klaten Blok B-12',
    contactName: 'Bu Sari',
    paymentMethod: 'campuran',
    paymentTermDays: 14,
    creditLimit: 75_000_000,
    active: true,
    note: '',
  }),
  partner({
    id: 'cus-03',
    kind: 'customer',
    name: 'Pasar Induk Wonogiri',
    group: 'Pasar',
    area: 'Wonogiri',
    phone: '0273-441-008',
    email: '',
    address: 'Komplek Pasar Induk',
    contactName: 'Pak Budi',
    paymentMethod: 'tunai',
    paymentTermDays: 7,
    creditLimit: 25_000_000,
    active: true,
    note: 'Volume menir & medium',
  }),
  partner({
    id: 'cus-04',
    kind: 'customer',
    name: 'Warung Bu Lastri',
    group: 'Retail',
    area: 'Sragen',
    phone: '0856-4411-2290',
    email: '',
    address: 'Jl. Raya Sragen–Solo Km 2',
    contactName: 'Bu Lastri',
    paymentMethod: 'tunai',
    paymentTermDays: 0,
    creditLimit: 5_000_000,
    active: true,
    note: 'COD',
  }),
  partner({
    id: 'cus-05',
    kind: 'customer',
    name: 'CV Pangan Sejahtera',
    legalName: 'CV Pangan Sejahtera',
    group: 'Institusi',
    area: 'Yogyakarta',
    phone: '0274-551-900',
    email: 'procurement@pangansejahtera.id',
    address: 'Jl. Magelang Km 5',
    contactName: 'Ibu Maya',
    contactPhone: '0813-7000-2211',
    npwp: '192.168.0.2-542.000',
    pkp: true,
    paymentMethod: 'transfer',
    paymentTermDays: 30,
    creditLimit: 200_000_000,
    bankName: 'Mandiri',
    bankAccount: '1370012345678',
    bankHolder: 'CV Pangan Sejahtera',
    active: true,
    note: 'Kontrak bulanan',
  }),
]

export const SEED_PRODUCTS: MasterProduct[] = [
  normalizeProduct({
    id: 'prd-01',
    sku: 'GBH-IR64',
    name: 'Gabah IR64',
    unit: 'kg',
    category: 'gabah',
    defaultPrice: 6700,
    costPrice: 6500,
    minQty: 500,
    taxable: false,
    note: 'Masuk dari penerimaan GKP',
  }),
  normalizeProduct({
    id: 'prd-02',
    sku: 'GBH-CIHERANG',
    name: 'Gabah Ciherang',
    unit: 'kg',
    category: 'gabah',
    defaultPrice: 8200,
    costPrice: 8000,
    minQty: 500,
    taxable: false,
    note: 'Biasanya GKG',
  }),
  normalizeProduct({
    id: 'prd-03',
    sku: 'BRS-PREM',
    name: 'Beras Premium 25kg',
    unit: 'sak',
    category: 'beras',
    barcode: '8991002200011',
    defaultPrice: 320_000,
    costPrice: 295_000,
    minQty: 20,
    taxable: true,
  }),
  normalizeProduct({
    id: 'prd-04',
    sku: 'BRS-MED',
    name: 'Beras Medium',
    unit: 'kg',
    category: 'beras',
    barcode: '8991002200028',
    defaultPrice: 11_500,
    costPrice: 10_200,
    minQty: 200,
    taxable: true,
  }),
  normalizeProduct({
    id: 'prd-05',
    sku: 'MNR-01',
    name: 'Menir',
    unit: 'kg',
    category: 'sampingan',
    defaultPrice: 4_500,
    costPrice: 3_800,
    minQty: 100,
    taxable: false,
  }),
  normalizeProduct({
    id: 'prd-06',
    sku: 'DDK-01',
    name: 'Dedak',
    unit: 'kg',
    category: 'sampingan',
    defaultPrice: 3_200,
    costPrice: 2_700,
    minQty: 100,
    taxable: false,
  }),
  normalizeProduct({
    id: 'prd-07',
    sku: 'SKM-01',
    name: 'Sekam',
    unit: 'kg',
    category: 'sampingan',
    defaultPrice: 800,
    costPrice: 500,
    minQty: 200,
    taxable: false,
  }),
]

export const SEED_USERS: MasterUser[] = [
  normalizeUser({
    id: 'USR-ADMIN',
    name: 'Admin E-Gabah',
    email: 'admin@egabah.local',
    role: 'admin',
    phone: '0812-0000-0001',
    branch: 'Kantor Pusat',
    department: 'Manajemen',
  }),
  normalizeUser({
    id: 'USR-PEMBELIAN',
    name: 'Petugas Pembelian',
    email: 'beli@egabah.local',
    role: 'pembelian',
    phone: '0812-0000-0002',
    department: 'Pembelian',
  }),
  normalizeUser({
    id: 'USR-PRODUKSI',
    name: 'Operator Produksi',
    email: 'produksi@egabah.local',
    role: 'produksi',
    phone: '0812-0000-0003',
    department: 'Produksi',
  }),
  normalizeUser({
    id: 'USR-GUDANG',
    name: 'Petugas Gudang',
    email: 'gudang@egabah.local',
    role: 'gudang',
    phone: '0812-0000-0004',
    department: 'Gudang',
  }),
  normalizeUser({
    id: 'USR-PENJUALAN',
    name: 'Petugas Penjualan',
    email: 'jual@egabah.local',
    role: 'penjualan',
    phone: '0812-0000-0005',
    department: 'Penjualan',
  }),
  normalizeUser({
    id: 'USR-KEUANGAN',
    name: 'Petugas Keuangan',
    email: 'kas@egabah.local',
    role: 'keuangan',
    phone: '0812-0000-0006',
    department: 'Keuangan',
  }),
]

export function nextPartnerId(kind: PartnerKind, list: MasterPartner[]): string {
  const prefix = kind === 'supplier' ? 'sup-' : 'cus-'
  const max = list
    .filter((p) => p.kind === kind)
    .reduce((m, p) => {
      const n = Number(p.id.replace(prefix, ''))
      return Number.isFinite(n) ? Math.max(m, n) : m
    }, 0)
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

export function nextProductId(list: MasterProduct[]): string {
  const max = list.reduce((m, p) => {
    const n = Number(p.id.replace('prd-', ''))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `prd-${String(max + 1).padStart(2, '0')}`
}

export function nextUserId(role: UserRole, list: MasterUser[]): string {
  const base = `USR-${role.toUpperCase()}`
  if (!list.some((u) => u.id === base)) return base
  let i = 2
  while (list.some((u) => u.id === `${base}-${i}`)) i += 1
  return `${base}-${i}`
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function buildMitraStats(partners: MasterPartner[]) {
  const suppliers = partners.filter((p) => p.kind === 'supplier')
  const customers = partners.filter((p) => p.kind === 'customer')
  return [
    {
      label: 'Pemasok aktif',
      value: String(suppliers.filter((p) => p.active).length),
      delta: `${suppliers.length} total`,
      positive: true,
      spark: [4, 5, 5, 6, 5, 6, 6],
    },
    {
      label: 'Pelanggan aktif',
      value: String(customers.filter((p) => p.active).length),
      delta: `${customers.length} total`,
      positive: true,
      spark: [3, 4, 4, 5, 5, 5, 6],
    },
    {
      label: 'Nonaktif',
      value: String(partners.filter((p) => !p.active).length),
      delta: 'ditandai arsip',
      positive: true,
      spark: [1, 1, 0, 1, 2, 1, 1],
    },
  ]
}

export function buildProdukStats(products: MasterProduct[]) {
  return [
    {
      label: 'Produk aktif',
      value: String(products.filter((p) => p.active).length),
      delta: `${products.length} SKU`,
      positive: true,
      spark: [5, 6, 6, 7, 7, 7, 8],
    },
    {
      label: 'Gabah',
      value: String(products.filter((p) => p.category === 'gabah').length),
      delta: 'kategori',
      positive: true,
      spark: [2, 2, 2, 2, 2, 2, 2],
    },
    {
      label: 'Beras & sampingan',
      value: String(
        products.filter((p) => p.category === 'beras' || p.category === 'sampingan')
          .length,
      ),
      delta: 'siap jual',
      positive: true,
      spark: [3, 4, 4, 5, 5, 5, 5],
    },
  ]
}

export function buildPenggunaStats(users: MasterUser[]) {
  return [
    {
      label: 'Pengguna aktif',
      value: String(users.filter((u) => u.active).length),
      delta: `${users.length} akun`,
      positive: true,
      spark: [4, 5, 5, 6, 6, 6, 6],
    },
    {
      label: 'Peran admin',
      value: String(users.filter((u) => u.role === 'admin').length),
      delta: 'akses penuh',
      positive: true,
      spark: [1, 1, 1, 1, 1, 1, 1],
    },
    {
      label: 'Nonaktif',
      value: String(users.filter((u) => !u.active).length),
      delta: 'ditangguhkan',
      positive: true,
      spark: [0, 0, 1, 0, 0, 1, 0],
    },
  ]
}
