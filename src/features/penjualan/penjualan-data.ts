import {
  lookupCustomer,
  lookupProductBySku,
} from '@/features/master/master-storage'

/** Alur: dibuat → dikirim → (tagihan / pelunasan). */
export type OrderStage = 'dibuat' | 'dikirim'

export type PaymentStatus = 'lunas' | 'sebagian' | 'belum' | 'terlambat'
export type PaymentMethod = 'tunai' | 'transfer'
/** Saat kirim: sudah dibayar (nota) atau kredit/tempo. */
export type SettlementMode = 'lunas' | 'kredit'

export type Customer = {
  id: string
  name: string
  city: string
}

export type SaleProduct = {
  sku: string
  name: string
  unit: string
  defaultPrice: number
}

export type Payment = {
  id: string
  date: string
  amount: number
  method: PaymentMethod
  /** Nama file bukti transfer / struk bayar */
  receiptName?: string
}

export type Delivery = {
  shippedAt: string
  vehicle?: string
  driver?: string
  note?: string
  /** Nama file bukti pengiriman / surat jalan */
  receiptName?: string
  /** Lunas di tempat vs kredit/tempo */
  settlement: SettlementMode
  /** Metode bayar jika settlement = lunas */
  payMethod?: PaymentMethod
  /** Nama file nota / bukti bayar — wajib jika lunas */
  payReceiptName?: string
}

export type SaleOrder = {
  id: string
  date: string
  customerId: string
  sku: string
  productName: string
  unit: string
  qty: number
  price: number
  note?: string
  stage: OrderStage
  delivery?: Delivery
  dueDate?: string
  payments: Payment[]
  voidedAt?: string
  voidReason?: string
}

export type NewSaleOrder = Omit<SaleOrder, 'id' | 'stage' | 'payments' | 'delivery' | 'dueDate'>

export type DeliveryInput = {
  vehicle?: string
  driver?: string
  note?: string
  receiptName?: string
  settlement: SettlementMode
  payMethod?: PaymentMethod
  payReceiptName?: string
}

export type OrderSummary = {
  total: number
  paid: number
  outstanding: number
  payment: PaymentStatus | null
}

export const PAYMENT_TERM_DAYS = 7

export const CUSTOMERS: Customer[] = [
  { id: 'cus-01', name: 'Toko Beras Makmur', city: 'Solo' },
  { id: 'cus-02', name: 'UD Sumber Rejeki', city: 'Klaten' },
  { id: 'cus-03', name: 'Pasar Induk Wonogiri', city: 'Wonogiri' },
  { id: 'cus-04', name: 'Warung Bu Lastri', city: 'Sragen' },
  { id: 'cus-05', name: 'CV Pangan Sejahtera', city: 'Yogyakarta' },
]

export const SALE_PRODUCTS: SaleProduct[] = [
  { sku: 'BRS-PREM', name: 'Beras Premium 25kg', unit: 'sak', defaultPrice: 320_000 },
  { sku: 'BRS-MED', name: 'Beras Medium', unit: 'kg', defaultPrice: 11_500 },
  { sku: 'MNR-01', name: 'Menir', unit: 'kg', defaultPrice: 4_500 },
  { sku: 'DDK-01', name: 'Dedak', unit: 'kg', defaultPrice: 3_200 },
]

export const STAGE_LABEL: Record<OrderStage, string> = {
  dibuat: 'Belum dikirim',
  dikirim: 'Sudah dikirim',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  lunas: 'Lunas',
  sebagian: 'Dibayar sebagian',
  belum: 'Belum dibayar',
  terlambat: 'Lewat jatuh tempo',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer bank',
}

export const SETTLEMENT_LABEL: Record<SettlementMode, string> = {
  lunas: 'Lunas (sudah dibayar)',
  kredit: 'Kredit / tempo',
}

export function getCustomer(id: string): Customer | undefined {
  const row = lookupCustomer(id)
  if (row) return { id: row.id, name: row.name, city: row.area }
  return CUSTOMERS.find((c) => c.id === id)
}

export function getProduct(sku: string): SaleProduct | undefined {
  const row = lookupProductBySku(sku)
  if (row) {
    return {
      sku: row.sku,
      name: row.name,
      unit: row.unit,
      defaultPrice: row.defaultPrice,
    }
  }
  return SALE_PRODUCTS.find((p) => p.sku === sku)
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function todayIso(): string {
  return toIso(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

export function summarize(order: SaleOrder, today = todayIso()): OrderSummary {
  if (order.voidedAt) {
    return { total: 0, paid: 0, outstanding: 0, payment: null }
  }
  const total = Math.round(order.qty * order.price)
  if (order.stage !== 'dikirim') {
    return { total, paid: 0, outstanding: 0, payment: null }
  }
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
  const outstanding = Math.max(0, total - paid)
  let payment: PaymentStatus
  if (outstanding <= 0) payment = 'lunas'
  else if (paid > 0) payment = 'sebagian'
  else if (order.dueDate && order.dueDate < today) payment = 'terlambat'
  else payment = 'belum'
  return { total, paid, outstanding, payment }
}

export function nextOrderId(
  orders: SaleOrder[],
  date = new Date(),
  docPrefix = 'SO',
): string {
  const prefix = `${docPrefix}-${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}-`
  const seq =
    orders
      .map((o) => o.id)
      .filter((id) => id.startsWith(prefix))
      .map((id) => Number(id.slice(prefix.length)))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => Math.max(max, n), 0) + 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

export function nextPaymentId(orders: SaleOrder[]): string {
  const all = orders.flatMap((o) => o.payments)
  const seq =
    all
      .map((p) => Number(p.id.replace(/\D/g, '')))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => Math.max(max, n), 0) + 1
  return `BYR-${String(seq).padStart(4, '0')}`
}

type SeedPayment = Omit<Payment, 'id' | 'amount'> & { amount: number | 'lunas' }
type Seed = Omit<SaleOrder, 'payments'> & { payments?: SeedPayment[] }

const SEED: Seed[] = [
  {
    id: 'SO-2610-0010',
    date: '2026-10-29',
    customerId: 'cus-01',
    sku: 'BRS-PREM',
    productName: 'Beras Premium 25kg',
    unit: 'sak',
    qty: 40,
    price: 320_000,
    stage: 'dibuat',
    note: 'Ambil di gudang A',
  },
  {
    id: 'SO-2610-0009',
    date: '2026-10-28',
    customerId: 'cus-03',
    sku: 'BRS-MED',
    productName: 'Beras Medium',
    unit: 'kg',
    qty: 1_500,
    price: 11_500,
    stage: 'dibuat',
  },
  {
    id: 'SO-2610-0008',
    date: '2026-10-27',
    customerId: 'cus-02',
    sku: 'BRS-PREM',
    productName: 'Beras Premium 25kg',
    unit: 'sak',
    qty: 20,
    price: 318_000,
    stage: 'dikirim',
    delivery: {
      shippedAt: '2026-10-27',
      vehicle: 'AB 1122 CD',
      driver: 'Pak Sulis',
      settlement: 'kredit',
      receiptName: 'sj-1122.jpg',
      note: 'Tempo 7 hari',
    },
    dueDate: '2026-11-03',
    payments: [],
  },
  {
    id: 'SO-2610-0007',
    date: '2026-10-26',
    customerId: 'cus-05',
    sku: 'BRS-MED',
    productName: 'Beras Medium',
    unit: 'kg',
    qty: 2_000,
    price: 11_400,
    stage: 'dikirim',
    delivery: {
      shippedAt: '2026-10-26',
      vehicle: 'AB 3344 EF',
      settlement: 'kredit',
      receiptName: 'sj-3344.jpg',
      note: 'DP dulu, sisa tempo',
    },
    dueDate: '2026-11-02',
    payments: [
      {
        date: '2026-10-28',
        amount: 10_000_000,
        method: 'transfer',
        receiptName: 'tf-dp-0007.jpg',
      },
    ],
  },
  {
    id: 'SO-2610-0006',
    date: '2026-10-24',
    customerId: 'cus-04',
    sku: 'MNR-01',
    productName: 'Menir',
    unit: 'kg',
    qty: 800,
    price: 4_500,
    stage: 'dikirim',
    delivery: {
      shippedAt: '2026-10-24',
      vehicle: 'AB 5566 GH',
      driver: 'Pak Agus',
      settlement: 'lunas',
      payMethod: 'tunai',
      payReceiptName: 'nota-tunai-0006.jpg',
      receiptName: 'sj-5566.jpg',
    },
    dueDate: '2026-10-24',
    payments: [
      {
        date: '2026-10-24',
        amount: 'lunas',
        method: 'tunai',
        receiptName: 'nota-tunai-0006.jpg',
      },
    ],
  },
  {
    id: 'SO-2610-0005',
    date: '2026-10-20',
    customerId: 'cus-01',
    sku: 'BRS-PREM',
    productName: 'Beras Premium 25kg',
    unit: 'sak',
    qty: 15,
    price: 315_000,
    stage: 'dikirim',
    delivery: {
      shippedAt: '2026-10-20',
      vehicle: 'AB 7788 IJ',
      settlement: 'kredit',
      receiptName: 'sj-7788.jpg',
      note: 'Kredit toko — jatuh tempo 27 Okt',
    },
    dueDate: '2026-10-27',
    payments: [],
  },
  {
    id: 'SO-2610-0004',
    date: '2026-10-18',
    customerId: 'cus-03',
    sku: 'DDK-01',
    productName: 'Dedak',
    unit: 'kg',
    qty: 1_200,
    price: 3_200,
    stage: 'dikirim',
    delivery: {
      shippedAt: '2026-10-18',
      settlement: 'kredit',
      receiptName: 'sj-0004.jpg',
      note: 'Kredit pasar induk',
    },
    dueDate: '2026-10-25',
    payments: [
      {
        date: '2026-10-22',
        amount: 2_000_000,
        method: 'transfer',
        receiptName: 'tf-partial-0004.jpg',
      },
    ],
  },
]

let seedPayNo = 0

export const INITIAL_ORDERS: SaleOrder[] = SEED.map((s) => {
  const { payments: seedPayments = [], ...rest } = s
  const base: SaleOrder = { ...rest, payments: [] }
  const total = summarize({ ...base, stage: 'dikirim' }).total
  return {
    ...base,
    payments: seedPayments.map((pay) => ({
      date: pay.date,
      method: pay.method,
      receiptName: pay.receiptName,
      id: `BYR-${String(++seedPayNo).padStart(4, '0')}`,
      amount: pay.amount === 'lunas' ? total : pay.amount,
    })),
  }
})

const numberFmt = new Intl.NumberFormat('id-ID')

export function formatNumber(value: number): string {
  return numberFmt.format(value)
}

export function formatQty(value: number, unit: string): string {
  return `${numberFmt.format(value)} ${unit}`
}

export function formatRupiah(value: number): string {
  return `Rp ${numberFmt.format(Math.round(value))}`
}

export function formatRupiahShort(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`
  return formatRupiah(value)
}

export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return new Intl.DateTimeFormat('id-ID', opts).format(new Date(`${iso}T00:00:00`))
}

export function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}
