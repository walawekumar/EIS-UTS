import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import type { PpnRate, PriceMode, TaxSnapshotFields } from '@/features/keuangan/tax-data'
import { readAppSettings } from '@/features/settings/app-settings'

export type CashDirection = 'in' | 'out'

export type CashEntry = {
  id: string
  date: string
  reference: string
  description: string
  category: string
  direction: CashDirection
  amount: number
  balance: number
  actor: string
  receiptName?: string
}

export type PayableStatus = 'open' | 'partial' | 'overdue' | 'paid'

export type PayableRow = {
  id: string
  supplier: string
  invoice: string
  dueDate: string
  amount: number
  paid: number
  status: PayableStatus
  agingDays: number
  receiptName?: string
}

export type ReceivableStatus = 'open' | 'partial' | 'overdue' | 'paid'

export type ReceivableRow = {
  id: string
  customer: string
  invoice: string
  dueDate: string
  amount: number
  paid: number
  status: ReceivableStatus
  agingDays: number
  receiptName?: string
}

export type ExpenseStatus = 'draft' | 'posted' | 'void'

export type ExpenseRow = {
  id: string
  date: string
  reference: string
  category: string
  description: string
  amount: number
  status: ExpenseStatus
  actor: string
  receiptName?: string
} & TaxSnapshotFields

export type ExpensePostTax = {
  ppnRate: PpnRate
  priceMode: PriceMode
}

/** Nilai keluar kas/jurnal (termasuk PPN bila ada snapshot). */
export function expenseDisplayAmount(row: ExpenseRow): number {
  return row.totalWithTax ?? row.amount
}

/** Tax settings first, then app finance.ppnRate, then 11% exclusive. */
export function resolveExpenseTaxDefaults(settings: {
  defaultRate?: number
  defaultPriceMode?: string
}): ExpensePostTax {
  const stored = settings.defaultRate
  const appRate = readAppSettings().finance.ppnRate
  const raw = stored === 0 || stored === 11 ? stored : appRate
  const ppnRate: PpnRate = raw === 0 ? 0 : 11
  const priceMode: PriceMode =
    settings.defaultPriceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  return { ppnRate, priceMode }
}

/** @deprecated gunakan MetricCardData — dipertahankan agar import lama tidak pecah */
export type FinanceStat = MetricCardData

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatIdrShort(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  }
  if (Math.abs(value) >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  }
  return formatIdr(value)
}

function sparkFrom(seed: number[], scale = 1): number[] {
  return seed.map((v) => Math.round(v * scale))
}

export const CASH_ENTRIES: CashEntry[] = [
  {
    id: 'c1',
    date: '29 Okt 2026',
    reference: 'KM-2401',
    description: 'Pelunasan invoice DO-0912',
    category: 'Piutang',
    direction: 'in',
    amount: 18_500_000,
    balance: 128_450_000,
    actor: 'Siti Keuangan',
  },
  {
    id: 'c2',
    date: '29 Okt 2026',
    reference: 'KK-1188',
    description: 'Bayar utang pemasok CV Sumber',
    category: 'Utang',
    direction: 'out',
    amount: 7_500_000,
    balance: 109_950_000,
    actor: 'Siti Keuangan',
  },
  {
    id: 'c3',
    date: '29 Okt 2026',
    reference: 'KK-1187',
    description: 'Biaya solar mesin giling',
    category: 'Operasional',
    direction: 'out',
    amount: 1_850_000,
    balance: 117_450_000,
    actor: 'Andi Ops',
  },
  {
    id: 'c4',
    date: '28 Okt 2026',
    reference: 'KM-2398',
    description: 'Uang muka order beras premium',
    category: 'Penjualan',
    direction: 'in',
    amount: 6_300_000,
    balance: 119_300_000,
    actor: 'Rina Sales',
  },
  {
    id: 'c5',
    date: '28 Okt 2026',
    reference: 'KK-1184',
    description: 'Gaji harian buruh gudang',
    category: 'Tenaga',
    direction: 'out',
    amount: 2_400_000,
    balance: 113_000_000,
    actor: 'Siti Keuangan',
  },
  {
    id: 'c6',
    date: '27 Okt 2026',
    reference: 'KM-2391',
    description: 'Transfer pelanggan Toko Berkah',
    category: 'Piutang',
    direction: 'in',
    amount: 12_000_000,
    balance: 115_400_000,
    actor: 'Siti Keuangan',
  },
  {
    id: 'c7',
    date: '27 Okt 2026',
    reference: 'KK-1179',
    description: 'Pembelian karung & tali',
    category: 'Operasional',
    direction: 'out',
    amount: 980_000,
    balance: 103_400_000,
    actor: 'Budi Gudang',
  },
  {
    id: 'c8',
    date: '26 Okt 2026',
    reference: 'KM-2384',
    description: 'Setoran tunai counter',
    category: 'Lainnya',
    direction: 'in',
    amount: 3_250_000,
    balance: 104_380_000,
    actor: 'Kasir',
  },
]

export const PAYABLES: PayableRow[] = [
  {
    id: 'p1',
    supplier: 'CV Sumber Gabah',
    invoice: 'AP-1042',
    dueDate: '31 Okt 2026',
    amount: 22_500_000,
    paid: 7_500_000,
    status: 'partial',
    agingDays: 2,
  },
  {
    id: 'p2',
    supplier: 'Koperasi Tani Makmur',
    invoice: 'AP-1038',
    dueDate: '28 Okt 2026',
    amount: 9_750_000,
    paid: 0,
    status: 'overdue',
    agingDays: 1,
  },
  {
    id: 'p3',
    supplier: 'UD Padi Sejahtera',
    invoice: 'AP-1035',
    dueDate: '05 Nov 2026',
    amount: 15_000_000,
    paid: 0,
    status: 'open',
    agingDays: 0,
  },
  {
    id: 'p4',
    supplier: 'CV Agro Nusantara',
    invoice: 'AP-1029',
    dueDate: '12 Nov 2026',
    amount: 18_200_000,
    paid: 0,
    status: 'open',
    agingDays: 0,
  },
  {
    id: 'p5',
    supplier: 'Kelompok Tani Harapan',
    invoice: 'AP-1021',
    dueDate: '20 Okt 2026',
    amount: 6_400_000,
    paid: 6_400_000,
    status: 'paid',
    agingDays: 0,
  },
  {
    id: 'p6',
    supplier: 'CV Sumber Gabah',
    invoice: 'AP-1018',
    dueDate: '03 Nov 2026',
    amount: 11_800_000,
    paid: 0,
    status: 'open',
    agingDays: 0,
  },
  {
    id: 'p7',
    supplier: 'UD Berkah Panen',
    invoice: 'AP-1012',
    dueDate: '25 Okt 2026',
    amount: 4_200_000,
    paid: 1_000_000,
    status: 'overdue',
    agingDays: 4,
  },
]

export const RECEIVABLES: ReceivableRow[] = [
  {
    id: 'r1',
    customer: 'Toko Berkah Jaya',
    invoice: 'AR-0912',
    dueDate: '30 Okt 2026',
    amount: 18_500_000,
    paid: 18_500_000,
    status: 'paid',
    agingDays: 0,
  },
  {
    id: 'r2',
    customer: 'Distributor Nusantara',
    invoice: 'AR-0908',
    dueDate: '27 Okt 2026',
    amount: 14_300_000,
    paid: 0,
    status: 'overdue',
    agingDays: 2,
  },
  {
    id: 'r3',
    customer: 'Warung Sembako Asri',
    invoice: 'AR-0904',
    dueDate: '02 Nov 2026',
    amount: 6_750_000,
    paid: 2_000_000,
    status: 'partial',
    agingDays: 0,
  },
  {
    id: 'r4',
    customer: 'CV Mitra Beras',
    invoice: 'AR-0899',
    dueDate: '08 Nov 2026',
    amount: 22_000_000,
    paid: 0,
    status: 'open',
    agingDays: 0,
  },
  {
    id: 'r5',
    customer: 'Koperasi Pasar Induk',
    invoice: 'AR-0891',
    dueDate: '04 Nov 2026',
    amount: 9_800_000,
    paid: 0,
    status: 'open',
    agingDays: 0,
  },
  {
    id: 'r6',
    customer: 'Toko Mulia Abadi',
    invoice: 'AR-0884',
    dueDate: '24 Okt 2026',
    amount: 5_400_000,
    paid: 0,
    status: 'overdue',
    agingDays: 5,
  },
  {
    id: 'r7',
    customer: 'PT Pangan Sejahtera',
    invoice: 'AR-0876',
    dueDate: '15 Nov 2026',
    amount: 31_200_000,
    paid: 10_000_000,
    status: 'partial',
    agingDays: 0,
  },
]

export const EXPENSES: ExpenseRow[] = [
  {
    id: 'e1',
    date: '29 Okt 2026',
    reference: 'BY-0421',
    category: 'Utilitas',
    description: 'Solar mesin giling batch BAT-0190',
    amount: 1_850_000,
    status: 'posted',
    actor: 'Andi Ops',
  },
  {
    id: 'e2',
    date: '28 Okt 2026',
    reference: 'BY-0418',
    category: 'Tenaga',
    description: 'Upah harian buruh gudang (8 orang)',
    amount: 2_400_000,
    status: 'posted',
    actor: 'Siti Keuangan',
  },
  {
    id: 'e3',
    date: '28 Okt 2026',
    reference: 'BY-0416',
    category: 'Transport',
    description: 'Ongkos angkut kirim DO-0881',
    amount: 750_000,
    status: 'posted',
    actor: 'Rina Sales',
  },
  {
    id: 'e4',
    date: '27 Okt 2026',
    reference: 'BY-0412',
    category: 'Pemeliharaan',
    description: 'Servis roller husker',
    amount: 3_200_000,
    status: 'draft',
    actor: 'Budi Produksi',
  },
  {
    id: 'e5',
    date: '26 Okt 2026',
    reference: 'BY-0408',
    category: 'Tenaga',
    description: 'Lembur operator shift malam',
    amount: 1_100_000,
    status: 'posted',
    actor: 'Siti Keuangan',
  },
  {
    id: 'e6',
    date: '25 Okt 2026',
    reference: 'BY-0401',
    category: 'Lainnya',
    description: 'ATK & konsumsi rapat mingguan',
    amount: 420_000,
    status: 'posted',
    actor: 'Admin',
  },
  {
    id: 'e7',
    date: '24 Okt 2026',
    reference: 'BY-0397',
    category: 'Utilitas',
    description: 'Tagihan listrik gudang A',
    amount: 4_850_000,
    status: 'draft',
    actor: 'Siti Keuangan',
  },
  {
    id: 'e8',
    date: '22 Okt 2026',
    reference: 'BY-0390',
    category: 'Transport',
    description: 'Sewa truk panen (dibatalkan)',
    amount: 1_500_000,
    status: 'void',
    actor: 'Admin',
  },
]

export const PAYABLE_STATUS_LABEL: Record<PayableStatus, string> = {
  open: 'Belum bayar',
  partial: 'Sebagian',
  overdue: 'Terlambat',
  paid: 'Lunas',
}

export const RECEIVABLE_STATUS_LABEL: Record<ReceivableStatus, string> = {
  open: 'Belum bayar',
  partial: 'Sebagian',
  overdue: 'Terlambat',
  paid: 'Lunas',
}

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  void: 'Void',
}

export const CASH_CATEGORIES = [
  { value: 'Piutang', label: 'Piutang' },
  { value: 'Utang', label: 'Utang' },
  { value: 'Penjualan', label: 'Penjualan' },
  { value: 'Operasional', label: 'Operasional' },
  { value: 'Tenaga', label: 'Tenaga' },
  { value: 'Lainnya', label: 'Lainnya' },
] as const

export const EXPENSE_CATEGORIES = [
  { value: 'Tenaga', label: 'Tenaga' },
  { value: 'Utilitas', label: 'Utilitas' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Pemeliharaan', label: 'Pemeliharaan' },
  { value: 'Lainnya', label: 'Lainnya' },
] as const

export function formatDateId(date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** Parse input seperti "7500000" atau "7.500.000" → number */
export function parseIdrInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return 0
  return Number(digits)
}

export function resolvePayableStatus(
  amount: number,
  paid: number,
  agingDays: number,
): PayableStatus {
  if (paid >= amount) return 'paid'
  if (agingDays > 0 && paid < amount) return 'overdue'
  if (paid > 0) return 'partial'
  return 'open'
}

export function resolveReceivableStatus(
  amount: number,
  paid: number,
  agingDays: number,
): ReceivableStatus {
  return resolvePayableStatus(amount, paid, agingDays)
}

export function buildKasStats(entries: CashEntry[]): MetricCardData[] {
  const today = formatDateId()
  const saldo = entries[0]?.balance ?? 0
  const todayIn = entries.filter((e) => e.date === today && e.direction === 'in')
  const todayOut = entries.filter((e) => e.date === today && e.direction === 'out')
  const sumIn = todayIn.reduce((s, e) => s + e.amount, 0)
  const sumOut = todayOut.reduce((s, e) => s + e.amount, 0)
  const net = entries.reduce(
    (s, e) => s + (e.direction === 'in' ? e.amount : -e.amount),
    0,
  )

  return [
    {
      label: 'Saldo kas',
      value: formatIdrShort(saldo),
      delta: '+5,2%',
      positive: true,
      spark: sparkFrom([88, 90, 92, 95, 98, 101, 104], saldo / 100),
    },
    {
      label: 'Masuk hari ini',
      value: formatIdrShort(sumIn),
      delta: `+${todayIn.length}`,
      positive: true,
      spark: sparkFrom([40, 55, 48, 62, 70, 65, Math.max(30, sumIn / 1_000_000)]),
    },
    {
      label: 'Keluar hari ini',
      value: formatIdrShort(sumOut),
      delta: sumOut > 0 ? '+8,1%' : '0%',
      positive: sumOut === 0,
      spark: sparkFrom([50, 45, 52, 48, 55, 42, Math.max(20, sumOut / 1_000_000)]),
    },
    {
      label: 'Net tercatat',
      value: formatIdrShort(net),
      delta: net >= 0 ? '+12%' : '−4,5%',
      positive: net >= 0,
      spark: sparkFrom([60, 62, 58, 70, 75, 72, 80]),
    },
  ]
}

export function buildUtangStats(rows: PayableRow[]): MetricCardData[] {
  const openRows = rows.filter((r) => r.status !== 'paid')
  const totalOpen = openRows.reduce((s, r) => s + (r.amount - r.paid), 0)
  const overdue = rows.filter((r) => r.status === 'overdue')
  const overdueSum = overdue.reduce((s, r) => s + (r.amount - r.paid), 0)
  const dueSoon = openRows.filter((r) => r.agingDays === 0 && r.status !== 'paid')
  const paidMonth = rows
    .filter((r) => r.paid > 0)
    .reduce((s, r) => s + r.paid, 0)

  return [
    {
      label: 'Total utang',
      value: formatIdrShort(totalOpen),
      delta: totalOpen > 0 ? '+3,4%' : '0%',
      positive: totalOpen === 0,
      spark: sparkFrom([70, 72, 68, 75, 80, 78, 82]),
    },
    {
      label: 'Belum jatuh tempo',
      value: formatIdrShort(
        dueSoon.reduce((s, r) => s + (r.amount - r.paid), 0),
      ),
      delta: `${dueSoon.length} dok`,
      positive: true,
      spark: sparkFrom([50, 52, 55, 53, 58, 60, 62]),
    },
    {
      label: 'Terlambat',
      value: formatIdrShort(overdueSum),
      delta: overdue.length > 0 ? `+${overdue.length}` : '0',
      positive: overdue.length === 0,
      spark: sparkFrom([40, 38, 42, 45, 43, 48, 50]),
    },
    {
      label: 'Sudah dibayar',
      value: formatIdrShort(paidMonth),
      delta: '+9,1%',
      positive: true,
      spark: sparkFrom([30, 35, 40, 48, 55, 60, 68]),
    },
  ]
}

export function buildPiutangStats(rows: ReceivableRow[]): MetricCardData[] {
  const openRows = rows.filter((r) => r.status !== 'paid')
  const totalOpen = openRows.reduce((s, r) => s + (r.amount - r.paid), 0)
  const overdue = rows.filter((r) => r.status === 'overdue')
  const overdueSum = overdue.reduce((s, r) => s + (r.amount - r.paid), 0)
  const dueSoon = openRows.filter((r) => r.agingDays === 0)
  const received = rows.reduce((s, r) => s + r.paid, 0)

  return [
    {
      label: 'Total piutang',
      value: formatIdrShort(totalOpen),
      delta: '+2,8%',
      positive: true,
      spark: sparkFrom([65, 68, 70, 72, 75, 78, 80]),
    },
    {
      label: 'Belum jatuh tempo',
      value: formatIdrShort(
        dueSoon.reduce((s, r) => s + (r.amount - r.paid), 0),
      ),
      delta: `${dueSoon.length} inv`,
      positive: true,
      spark: sparkFrom([45, 48, 50, 52, 55, 54, 58]),
    },
    {
      label: 'Terlambat',
      value: formatIdrShort(overdueSum),
      delta: overdue.length > 0 ? `−${overdue.length}` : '0',
      positive: overdue.length === 0,
      spark: sparkFrom([55, 52, 50, 48, 45, 42, 40]),
    },
    {
      label: 'Sudah diterima',
      value: formatIdrShort(received),
      delta: '+11%',
      positive: true,
      spark: sparkFrom([35, 40, 45, 50, 58, 62, 70]),
    },
  ]
}

export function buildBiayaStats(rows: ExpenseRow[]): MetricCardData[] {
  const active = rows.filter((r) => r.status !== 'void')
  const total = active.reduce((s, r) => s + expenseDisplayAmount(r), 0)
  const drafts = rows.filter((r) => r.status === 'draft')
  const byCat = new Map<string, number>()
  for (const row of active) {
    byCat.set(
      row.category,
      (byCat.get(row.category) ?? 0) + expenseDisplayAmount(row),
    )
  }
  let topCat = '—'
  let topSum = 0
  for (const [cat, sum] of byCat) {
    if (sum > topSum) {
      topCat = cat
      topSum = sum
    }
  }
  const posted = rows.filter((r) => r.status === 'posted').length
  const denom = Math.max(1, rows.filter((r) => r.status !== 'void').length)
  const postedPct = Math.round((posted / denom) * 100)
  const topSharePct =
    total > 0 ? Math.round((topSum / total) * 100) : 0
  const draftPct = Math.round((drafts.length / Math.max(1, rows.length)) * 100)

  return [
    {
      label: 'Biaya aktif',
      value: formatIdrShort(total),
      delta: '−8,4%',
      positive: true,
      spark: sparkFrom([80, 78, 75, 70, 68, 65, 62]),
    },
    {
      label: 'Sudah posting',
      value: String(posted),
      delta: `${postedPct}%`,
      positive: postedPct >= 50,
      spark: sparkFrom([2, 3, 3, 4, 5, 5, posted || 1]),
    },
    {
      label: 'Kategori terbesar',
      value: topCat,
      delta: `${topSharePct}%`,
      positive: true,
      spark: sparkFrom([40, 45, 50, 55, 60, 58, 65]),
    },
    {
      label: 'Draft',
      value: String(drafts.length),
      delta: drafts.length > 0 ? `${draftPct}%` : '0%',
      positive: drafts.length === 0,
      spark: sparkFrom([5, 4, 4, 3, 3, 2, drafts.length || 1]),
    },
  ]
}

export function nextCashRef(entries: CashEntry[], direction: CashDirection): string {
  const prefix = direction === 'in' ? 'KM' : 'KK'
  const nums = entries
    .filter((e) => e.reference.startsWith(prefix))
    .map((e) => Number(e.reference.split('-')[1] ?? 0))
  const next = (nums.length ? Math.max(...nums) : 1000) + 1
  return `${prefix}-${next}`
}

export function nextExpenseRef(rows: ExpenseRow[]): string {
  const nums = rows.map((e) => Number(e.reference.split('-')[1] ?? 0))
  const next = (nums.length ? Math.max(...nums) : 400) + 1
  return `BY-${String(next).padStart(4, '0')}`
}
