import type { MetricCardData } from '@/features/dashboard/dashboard-data'

export type StockCategory = 'gabah' | 'beras' | 'sampingan'

export type StockRow = {
  id: string
  sku: string
  name: string
  category: StockCategory
  location: string
  unit: string
  qty: number
  minQty: number
  updatedAt: string
}

export type MovementType = 'in' | 'out' | 'transfer'

export type MovementRow = {
  id: string
  date: string
  reference: string
  type: MovementType
  sku: string
  productName: string
  fromLocation: string
  toLocation: string
  qty: number
  unit: string
  note: string
  actor: string
  receiptName?: string
}

export type CorrectionStatus = 'posted' | 'void'

export type CorrectionRow = {
  id: string
  date: string
  reference: string
  sku: string
  productName: string
  location: string
  beforeQty: number
  afterQty: number
  unit: string
  reason: string
  status: CorrectionStatus
  actor: string
  receiptName?: string
}

export const LOCATIONS = [
  'Gudang A',
  'Gudang B',
  'Silo 1',
  'Lantai Produksi',
] as const

export const CATEGORY_LABEL: Record<StockCategory, string> = {
  gabah: 'Gabah',
  beras: 'Beras',
  sampingan: 'Sampingan',
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: 'Masuk',
  out: 'Keluar',
  transfer: 'Transfer',
}

export function formatQty(value: number, unit = 'kg'): string {
  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(value)} ${unit}`
}

export function formatDateId(date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function isLowStock(row: StockRow): boolean {
  return row.qty <= row.minQty
}

export const STOCK_ROWS: StockRow[] = [
  {
    id: 's1',
    sku: 'GBH-IR64',
    name: 'Gabah IR64',
    category: 'gabah',
    location: 'Silo 1',
    unit: 'kg',
    qty: 12_480,
    minQty: 5_000,
    updatedAt: '29 Okt 2026',
  },
  {
    id: 's2',
    sku: 'GBH-CIHERANG',
    name: 'Gabah Ciherang',
    category: 'gabah',
    location: 'Gudang A',
    unit: 'kg',
    qty: 4_200,
    minQty: 4_500,
    updatedAt: '28 Okt 2026',
  },
  {
    id: 's3',
    sku: 'BRS-PREM',
    name: 'Beras Premium 25kg',
    category: 'beras',
    location: 'Gudang A',
    unit: 'sak',
    qty: 860,
    minQty: 200,
    updatedAt: '29 Okt 2026',
  },
  {
    id: 's4',
    sku: 'BRS-MED',
    name: 'Beras Medium',
    category: 'beras',
    location: 'Gudang B',
    unit: 'kg',
    qty: 3_150,
    minQty: 2_000,
    updatedAt: '27 Okt 2026',
  },
  {
    id: 's5',
    sku: 'MNR-01',
    name: 'Menir',
    category: 'sampingan',
    location: 'Gudang B',
    unit: 'kg',
    qty: 780,
    minQty: 500,
    updatedAt: '26 Okt 2026',
  },
  {
    id: 's6',
    sku: 'DDK-01',
    name: 'Dedak',
    category: 'sampingan',
    location: 'Lantai Produksi',
    unit: 'kg',
    qty: 420,
    minQty: 600,
    updatedAt: '29 Okt 2026',
  },
  {
    id: 's7',
    sku: 'SKM-01',
    name: 'Sekam',
    category: 'sampingan',
    location: 'Lantai Produksi',
    unit: 'kg',
    qty: 1_050,
    minQty: 400,
    updatedAt: '25 Okt 2026',
  },
  {
    id: 's8',
    sku: 'BRS-PREM',
    name: 'Beras Premium 25kg',
    category: 'beras',
    location: 'Gudang B',
    unit: 'sak',
    qty: 120,
    minQty: 150,
    updatedAt: '28 Okt 2026',
  },
]

export const MOVEMENTS: MovementRow[] = [
  {
    id: 'm1',
    date: '29 Okt 2026',
    reference: 'MUT-2210',
    type: 'in',
    sku: 'GBH-IR64',
    productName: 'Gabah IR64',
    fromLocation: '',
    toLocation: 'Silo 1',
    qty: 2_500,
    unit: 'kg',
    note: 'Penerimaan RCV-0241',
    actor: 'Budi Gudang',
  },
  {
    id: 'm2',
    date: '29 Okt 2026',
    reference: 'MUT-2209',
    type: 'out',
    sku: 'GBH-IR64',
    productName: 'Gabah IR64',
    fromLocation: 'Silo 1',
    toLocation: '',
    qty: 1_800,
    unit: 'kg',
    note: 'Ke batch BAT-0190',
    actor: 'Andi Ops',
  },
  {
    id: 'm3',
    date: '28 Okt 2026',
    reference: 'MUT-2204',
    type: 'transfer',
    sku: 'BRS-PREM',
    productName: 'Beras Premium 25kg',
    fromLocation: 'Gudang A',
    toLocation: 'Gudang B',
    qty: 40,
    unit: 'sak',
    note: 'Siapkan order DO-0881',
    actor: 'Budi Gudang',
  },
  {
    id: 'm4',
    date: '27 Okt 2026',
    reference: 'MUT-2198',
    type: 'out',
    sku: 'BRS-MED',
    productName: 'Beras Medium',
    fromLocation: 'Gudang B',
    toLocation: '',
    qty: 500,
    unit: 'kg',
    note: 'Pengiriman DO-0876',
    actor: 'Rina Sales',
  },
  {
    id: 'm5',
    date: '26 Okt 2026',
    reference: 'MUT-2191',
    type: 'in',
    sku: 'MNR-01',
    productName: 'Menir',
    fromLocation: '',
    toLocation: 'Gudang B',
    qty: 180,
    unit: 'kg',
    note: 'Output produksi BAT-0188',
    actor: 'Andi Ops',
  },
]

export const CORRECTIONS: CorrectionRow[] = [
  {
    id: 'k1',
    date: '28 Okt 2026',
    reference: 'ADJ-0077',
    sku: 'DDK-01',
    productName: 'Dedak',
    location: 'Lantai Produksi',
    beforeQty: 480,
    afterQty: 420,
    unit: 'kg',
    reason: 'Susut timbang ulang',
    status: 'posted',
    actor: 'Budi Gudang',
  },
  {
    id: 'k2',
    date: '25 Okt 2026',
    reference: 'ADJ-0072',
    sku: 'GBH-CIHERANG',
    productName: 'Gabah Ciherang',
    location: 'Gudang A',
    beforeQty: 4_050,
    afterQty: 4_200,
    unit: 'kg',
    reason: 'Selisih penerimaan tertunda',
    status: 'posted',
    actor: 'Admin',
  },
  {
    id: 'k3',
    date: '22 Okt 2026',
    reference: 'ADJ-0068',
    sku: 'SKM-01',
    productName: 'Sekam',
    location: 'Lantai Produksi',
    beforeQty: 1_100,
    afterQty: 1_050,
    unit: 'kg',
    reason: 'Koreksi salah input (dibatalkan)',
    status: 'void',
    actor: 'Admin',
  },
]

export function buildSaldoStats(rows: StockRow[]): MetricCardData[] {
  const totalSku = new Set(rows.map((r) => r.sku)).size
  const low = rows.filter(isLowStock)
  const locations = new Set(rows.map((r) => r.location)).size
  const totalKg = rows
    .filter((r) => r.unit === 'kg')
    .reduce((s, r) => s + r.qty, 0)

  return [
    {
      label: 'SKU aktif',
      value: String(totalSku),
      delta: `+${rows.length} baris`,
      positive: true,
    },
    {
      label: 'Stok (kg)',
      value: formatQty(totalKg, 'kg').replace(' kg', ''),
      delta: '+2,4%',
      positive: true,
    },
    {
      label: 'Stok rendah',
      value: String(low.length),
      delta: low.length > 0 ? `+${low.length}` : '0',
      positive: low.length === 0,
    },
    {
      label: 'Lokasi',
      value: String(locations),
      delta: `${LOCATIONS.length} gudang`,
      positive: true,
    },
  ]
}

export function buildMutasiStats(rows: MovementRow[]): MetricCardData[] {
  const masuk = rows.filter((r) => r.type === 'in')
  const keluar = rows.filter((r) => r.type === 'out')
  const transfer = rows.filter((r) => r.type === 'transfer')
  return [
    {
      label: 'Total mutasi',
      value: String(rows.length),
      delta: '+5',
      positive: true,
    },
    {
      label: 'Masuk',
      value: String(masuk.length),
      delta: `+${masuk.length}`,
      positive: true,
    },
    {
      label: 'Keluar',
      value: String(keluar.length),
      delta: `+${keluar.length}`,
      positive: keluar.length === 0,
    },
    {
      label: 'Transfer',
      value: String(transfer.length),
      delta: `+${transfer.length}`,
      positive: true,
    },
  ]
}

export function buildKoreksiStats(rows: CorrectionRow[]): MetricCardData[] {
  const posted = rows.filter((r) => r.status === 'posted')
  const voids = rows.filter((r) => r.status === 'void')
  const deltaAbs = posted.reduce(
    (s, r) => s + Math.abs(r.afterQty - r.beforeQty),
    0,
  )
  return [
    {
      label: 'Dokumen',
      value: String(rows.length),
      delta: `+${rows.length}`,
      positive: true,
    },
    {
      label: 'Posted',
      value: String(posted.length),
      delta: `+${posted.length}`,
      positive: true,
    },
    {
      label: 'Void',
      value: String(voids.length),
      delta: voids.length > 0 ? `+${voids.length}` : '0',
      positive: voids.length === 0,
    },
    {
      label: 'Δ qty posted',
      value: formatQty(deltaAbs).replace(/ kg$/, ''),
      delta: 'abs',
      positive: true,
    },
  ]
}

export function nextMovementRef(rows: MovementRow[]): string {
  const nums = rows.map((r) => Number(r.reference.split('-')[1] ?? 0))
  const next = (nums.length ? Math.max(...nums) : 2100) + 1
  return `MUT-${next}`
}

export function nextCorrectionRef(rows: CorrectionRow[]): string {
  const nums = rows.map((r) => Number(r.reference.split('-')[1] ?? 0))
  const next = (nums.length ? Math.max(...nums) : 60) + 1
  return `ADJ-${String(next).padStart(4, '0')}`
}

export function stockKey(sku: string, location: string) {
  return `${sku}::${location}`
}
