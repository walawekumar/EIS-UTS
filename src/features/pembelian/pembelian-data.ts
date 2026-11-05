import type { PpnRate, PriceMode, TaxSnapshotFields } from '@/features/keuangan/tax-data'
import { lookupSupplier } from '@/features/master/master-storage'
import { readAppSettings } from '@/features/settings/app-settings'
import type { ApprovalStamp } from '@/features/workflow/approvals'
import type { ReturnStage } from '@/features/workflow/doc-stages'
import type { ProofAttachment } from '@/features/workflow/proof'

export type PurchaseReturnLine = { sku: string; productName: string; unit: string; qty: number }

export type PurchaseReturn = {
  id: string
  purchaseId: string
  lotId?: string
  lines: PurchaseReturnLine[]
  reason: string
  stage: ReturnStage
  approvals?: ApprovalStamp[]
  createdAt: string
  postedAt?: string
  rejectedReason?: string
} & TaxSnapshotFields

export type LotQcGrade = 'A' | 'B' | 'C' | 'reject'

export type LotQc = {
  lotId: string
  purchaseId: string
  moisture: number
  impurity: number
  brokenPct: number
  grade: LotQcGrade
  passed: boolean
  note?: string
  by: string
  at: string
  overrideReason?: string
}

export function returnedQtyForPurchase(
  returns: PurchaseReturn[],
  purchaseId: string,
  sku: string,
): number {
  return returns
    .filter((r) => r.purchaseId === purchaseId && r.stage === 'posted')
    .flatMap((r) => r.lines)
    .filter((l) => l.sku === sku)
    .reduce((s, l) => s + l.qty, 0)
}

export function nextPurchaseReturnId(returns: PurchaseReturn[]): string {
  const n = returns.length + 1
  return `PR-${String(n).padStart(4, '0')}`
}

export function getLotQc(list: LotQc[], lotId: string): LotQc | undefined {
  return list.find((q) => q.lotId === lotId)
}

export function upsertLotQc(list: LotQc[], row: LotQc): LotQc[] {
  return [...list.filter((q) => q.lotId !== row.lotId), row]
}

export type GrainType = 'GKP' | 'GKG'

export type PurchaseStage =
  | 'draft'
  | 'diajukan'
  | 'disetujui'
  | 'ditolak'
  | 'ditimbang'
  | 'menunggu_selesai'
  | 'selesai'

export const STAGE_LABEL: Record<PurchaseStage, string> = {
  draft: 'Draft',
  diajukan: 'Menunggu approve',
  disetujui: 'Disetujui keuangan',
  ditolak: 'Ditolak',
  ditimbang: 'Ditimbang',
  menunggu_selesai: 'Menunggu selesai',
  selesai: 'Selesai',
}

export function migratePurchaseStage(raw: string): PurchaseStage {
  if (raw === 'dicatat') return 'diajukan'
  if (raw === 'diterima') return 'selesai'
  if (
    raw === 'draft' ||
    raw === 'diajukan' ||
    raw === 'disetujui' ||
    raw === 'ditolak' ||
    raw === 'ditimbang' ||
    raw === 'menunggu_selesai' ||
    raw === 'selesai'
  )
    return raw
  return 'draft'
}

export function isPurchaseReceivedForAp(stage: PurchaseStage): boolean {
  return stage === 'menunggu_selesai' || stage === 'selesai'
}

export function canHardDeletePurchase(stage: PurchaseStage): boolean {
  return stage === 'draft' || stage === 'ditolak'
}

export function canVoidPurchase(stage: PurchaseStage): boolean {
  return stage === 'ditimbang' || stage === 'menunggu_selesai' || stage === 'selesai'
}

export function isPurchaseAwaitingWeigh(stage: PurchaseStage): boolean {
  return stage === 'disetujui'
}

export type PaymentStatus = 'lunas' | 'sebagian' | 'belum' | 'terlambat'

export type PaymentMethod = 'tunai' | 'transfer'

export type Supplier = {
  id: string
  name: string
  village: string
}

export type Weighing = {
  bruto: number // kg
  tara: number // kg karung
  moisture: number // % kadar air
  impurity: number // % hampa/kotoran
  weighedAt: string // ISO
  confirmedAt?: string // ISO
  /** Nama file bukti timbang / serah terima gabah */
  receiptName?: string
}

export type Payment = {
  id: string
  date: string // ISO
  amount: number // Rp
  method: PaymentMethod
  /** Nama file bukti transfer / struk bayar */
  receiptName?: string
  transferProof?: ProofAttachment | string
}

export type NewPayment = Omit<Payment, 'id'>

export type Purchase = {
  id: string
  date: string // ISO, tanggal pencatatan
  supplierId: string
  grain: GrainType
  sacks: number
  estimatedKg: number // taksiran berat saat dicatat
  price: number // Rp per kg netto (harga sepakat)
  /** Harga efektif setelah potongan kadar air (diisi saat diterima) */
  effectivePrice?: number
  /** Lot gabah untuk trace ke produksi */
  lotId?: string
  vehicle?: string
  note?: string
  stage: PurchaseStage
  weighing?: Weighing
  dueDate?: string // ISO, jatuh tempo pembayaran
  payments: Payment[]
  invoiceProof?: ProofAttachment | string
  purchaseProof?: ProofAttachment | string
  approvals?: ApprovalStamp[]
  rejectReason?: string
  budgetApprovedAt?: string
  completedAt?: string
  voidedAt?: string
  voidReason?: string
} & TaxSnapshotFields

export type WeighingInput = Pick<Weighing, 'bruto' | 'tara' | 'moisture' | 'impurity'> & {
  receiptName?: string
}

export type NewPurchase = Omit<Purchase, 'id' | 'stage' | 'payments'>

export type WeighingCalc = {
  weighed: number
  moistureCut: number
  impurityCut: number
  rafaksi: number
  netto: number
}

export type PurchaseSummary = {
  weighing: WeighingCalc | null
  estimatedValue: number
  total: number
  paid: number
  outstanding: number
  variancePct: number | null // selisih berat timbang vs taksiran
  payment: PaymentStatus | null
}

/** Batas mutu sebelum dikenai rafaksi (potongan berat). */
export const GRAIN_STANDARD: Record<GrainType, { label: string; moisture: number; impurity: number }> = {
  GKP: { label: 'Gabah Kering Panen', moisture: 25, impurity: 10 },
  GKG: { label: 'Gabah Kering Giling', moisture: 14, impurity: 3 },
}

export const DEFAULT_PRICE: Record<GrainType, number> = {
  GKP: 6700,
  GKG: 8200,
}

export const TARA_PER_SACK = 1 // kg
export const PAYMENT_TERM_DAYS = 7
export const VARIANCE_TOLERANCE = 3 // %
/** Potongan harga Rp/kg per 1% kadar air di atas standar */
export const MOISTURE_PRICE_CUT_PER_PCT = 50

export const SUPPLIERS: Supplier[] = [
  { id: 'sup-01', name: 'Kelompok Tani Sri Rejeki', village: 'Desa Ngawen' },
  { id: 'sup-02', name: 'Pak Darmo', village: 'Desa Sukamaju' },
  { id: 'sup-03', name: 'UD Tani Makmur', village: 'Kec. Karanganyar' },
  { id: 'sup-04', name: 'Bu Suminah', village: 'Desa Tegalsari' },
  { id: 'sup-05', name: 'Koperasi Tani Sejahtera', village: 'Kec. Gondang' },
]

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

export function getSupplier(id: string): Supplier | undefined {
  const row = lookupSupplier(id)
  if (row) return { id: row.id, name: row.name, village: row.area }
  return SUPPLIERS.find((s) => s.id === id)
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

export function calcWeighing(grain: GrainType, w: WeighingInput): WeighingCalc {
  const std = GRAIN_STANDARD[grain]
  const weighed = Math.max(0, w.bruto - w.tara)
  const round2 = (n: number) => Math.round(n * 100) / 100
  const moistureCut = round2(Math.max(0, w.moisture - std.moisture))
  const impurityCut = round2(Math.max(0, w.impurity - std.impurity))
  const rafaksi = round2(moistureCut + impurityCut)
  const netto = Math.round(weighed * (1 - rafaksi / 100))
  return { weighed, moistureCut, impurityCut, rafaksi, netto }
}

/** Harga per kg setelah potongan kadar air (impurity hanya potong berat). */
export function effectiveUnitPrice(
  grain: GrainType,
  basePrice: number,
  moisture: number,
): number {
  const excess = Math.max(0, moisture - GRAIN_STANDARD[grain].moisture)
  return Math.max(
    0,
    Math.round(basePrice - excess * MOISTURE_PRICE_CUT_PER_PCT),
  )
}

export function purchaseUnitPrice(purchase: Purchase): number {
  if (purchase.effectivePrice != null) return purchase.effectivePrice
  if (purchase.weighing) {
    return effectiveUnitPrice(
      purchase.grain,
      purchase.price,
      purchase.weighing.moisture,
    )
  }
  return purchase.price
}

export type PurchasePostTax = {
  ppnRate: PpnRate
  priceMode: PriceMode
}

export type PurchaseReceiveTax = PurchasePostTax & {
  supplierFakturNo?: string
}

/** Tax settings first, then app finance.ppnRate, then 11% exclusive. */
export function resolvePurchaseTaxDefaults(settings: {
  defaultRate?: number
  defaultPriceMode?: string
}): PurchasePostTax {
  const stored = settings.defaultRate
  const appRate = readAppSettings().finance.ppnRate
  const raw = stored === 0 || stored === 11 ? stored : appRate
  const ppnRate: PpnRate = raw === 0 ? 0 : 11
  const priceMode: PriceMode =
    settings.defaultPriceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  return { ppnRate, priceMode }
}

export function nextLotId(items: Purchase[], date = new Date()): string {
  const head = `LOT-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-`
  const max = items.reduce((m, p) => {
    if (!p.lotId?.startsWith(head)) return m
    const n = Number(p.lotId.slice(head.length))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `${head}${String(max + 1).padStart(3, '0')}`
}

export function summarize(p: Purchase, today = todayIso()): PurchaseSummary {
  if (p.voidedAt) {
    return {
      weighing: p.weighing ? calcWeighing(p.grain, p.weighing) : null,
      estimatedValue: 0,
      total: 0,
      paid: 0,
      outstanding: 0,
      variancePct: null,
      payment: null,
    }
  }
  const weighing = p.weighing ? calcWeighing(p.grain, p.weighing) : null
  const unitPrice =
    p.effectivePrice ??
    (weighing
      ? effectiveUnitPrice(p.grain, p.price, p.weighing!.moisture)
      : p.price)
  const received = isPurchaseReceivedForAp(p.stage)
  const pretax = received && weighing ? weighing.netto * unitPrice : 0
  const total = p.totalWithTax ?? pretax
  const paid = p.payments.reduce((sum, pay) => sum + pay.amount, 0)
  const outstanding = Math.max(0, total - paid)

  let payment: PaymentStatus | null = null
  if (received) {
    if (outstanding === 0) payment = 'lunas'
    else if (p.dueDate && p.dueDate < today) payment = 'terlambat'
    else payment = paid > 0 ? 'sebagian' : 'belum'
  }

  return {
    weighing,
    estimatedValue: p.estimatedKg * p.price,
    total,
    paid,
    outstanding,
    variancePct:
      weighing && p.estimatedKg > 0
        ? ((weighing.weighed - p.estimatedKg) / p.estimatedKg) * 100
        : null,
    payment,
  }
}

export function nextPurchaseId(
  items: Purchase[],
  date = new Date(),
  docPrefix = 'PB',
): string {
  const yymm = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}`
  const prefix = `${docPrefix}-${yymm}-`
  const max = items
    .filter((p) => p.id.startsWith(prefix))
    .reduce((m, p) => Math.max(m, Number(p.id.slice(prefix.length)) || 0), 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export function nextPaymentId(items: Purchase[]): string {
  const max = items
    .flatMap((p) => p.payments)
    .reduce((m, pay) => Math.max(m, Number(pay.id.replace('BYR-', '')) || 0), 0)
  return `BYR-${String(max + 1).padStart(4, '0')}`
}

type SeedPayment = Omit<Payment, 'id' | 'amount'> & { amount: number | 'lunas' }
type Seed = Omit<Purchase, 'payments' | 'stage'> & {
  stage: string
  payments?: SeedPayment[]
}

const SEED: Seed[] = [
  { id: 'PB-2611-0021', date: '2026-11-05', supplierId: 'sup-04', grain: 'GKP', sacks: 14, estimatedKg: 700, price: 6600, vehicle: 'AD 8812 KL', stage: 'dicatat' },
  { id: 'PB-2611-0020', date: '2026-11-05', supplierId: 'sup-02', grain: 'GKP', sacks: 24, estimatedKg: 1200, price: 6600, vehicle: 'AD 1450 BG', stage: 'dicatat', note: 'Panen sawah blok timur' },
  { id: 'PB-2611-0019', date: '2026-11-04', supplierId: 'sup-01', grain: 'GKP', sacks: 40, estimatedKg: 2500, price: 6700, vehicle: 'AD 9031 AF', stage: 'ditimbang',
    weighing: { bruto: 2480, tara: 40, moisture: 26.5, impurity: 8, weighedAt: '2026-11-04' } },
  { id: 'PB-2611-0018', date: '2026-11-04', supplierId: 'sup-03', grain: 'GKG', sacks: 25, estimatedKg: 1200, price: 8200, stage: 'diterima', dueDate: '2026-11-11',
    weighing: { bruto: 1215, tara: 25, moisture: 14.5, impurity: 2.5, weighedAt: '2026-11-04', confirmedAt: '2026-11-04' } },
  { id: 'PB-2611-0017', date: '2026-11-03', supplierId: 'sup-02', grain: 'GKP', sacks: 16, estimatedKg: 950, price: 6600, stage: 'diterima', dueDate: '2026-11-10',
    weighing: { bruto: 960, tara: 16, moisture: 24, impurity: 9, weighedAt: '2026-11-03', confirmedAt: '2026-11-03' },
    payments: [{ date: '2026-11-03', amount: 3_000_000, method: 'tunai' }] },
  { id: 'PB-2611-0016', date: '2026-11-02', supplierId: 'sup-05', grain: 'GKG', sacks: 50, estimatedKg: 3000, price: 8250, stage: 'diterima', dueDate: '2026-11-09',
    weighing: { bruto: 3050, tara: 50, moisture: 13.8, impurity: 2.8, weighedAt: '2026-11-02', confirmedAt: '2026-11-02' },
    payments: [{ date: '2026-11-03', amount: 'lunas', method: 'transfer' }] },
  { id: 'PB-2611-0015', date: '2026-11-01', supplierId: 'sup-01', grain: 'GKP', sacks: 30, estimatedKg: 1900, price: 6700, stage: 'diterima', dueDate: '2026-11-08',
    weighing: { bruto: 1880, tara: 30, moisture: 25.5, impurity: 9.5, weighedAt: '2026-11-01', confirmedAt: '2026-11-01' },
    payments: [{ date: '2026-11-01', amount: 'lunas', method: 'tunai' }] },
  { id: 'PB-2610-0014', date: '2026-10-28', supplierId: 'sup-03', grain: 'GKG', sacks: 36, estimatedKg: 2200, price: 8200, stage: 'diterima', dueDate: '2026-11-04',
    weighing: { bruto: 2210, tara: 36, moisture: 14, impurity: 3, weighedAt: '2026-10-28', confirmedAt: '2026-10-28' },
    payments: [{ date: '2026-10-29', amount: 'lunas', method: 'transfer' }] },
  { id: 'PB-2610-0013', date: '2026-10-25', supplierId: 'sup-05', grain: 'GKG', sacks: 28, estimatedKg: 1750, price: 8250, stage: 'diterima', dueDate: '2026-11-01',
    weighing: { bruto: 1760, tara: 28, moisture: 14.2, impurity: 3.4, weighedAt: '2026-10-25', confirmedAt: '2026-10-25' },
    payments: [{ date: '2026-10-26', amount: 10_000_000, method: 'transfer' }] },
  { id: 'PB-2610-0012', date: '2026-10-22', supplierId: 'sup-04', grain: 'GKP', sacks: 12, estimatedKg: 620, price: 6500, stage: 'diterima', dueDate: '2026-10-29',
    weighing: { bruto: 640, tara: 12, moisture: 27, impurity: 11, weighedAt: '2026-10-22', confirmedAt: '2026-10-22' } },
]

let seedPaymentNo = 0

export const INITIAL_PURCHASES: Purchase[] = SEED.map((s, idx) => {
  const stage = migratePurchaseStage(s.stage)
  const lotId = isPurchaseReceivedForAp(stage)
    ? `LOT-202610-${String(idx + 1).padStart(3, '0')}`
    : undefined
  const base: Purchase = { ...s, stage, payments: [], lotId }
  const total = summarize({ ...base, stage: 'selesai' }).total
  return {
    ...base,
    payments: (s.payments ?? []).map((pay) => ({
      ...pay,
      id: `BYR-${String(++seedPaymentNo).padStart(4, '0')}`,
      amount: pay.amount === 'lunas' ? total : pay.amount,
    })),
  }
})

const numberFmt = new Intl.NumberFormat('id-ID')

export function formatNumber(value: number): string {
  return numberFmt.format(value)
}

export function formatKg(value: number): string {
  return `${numberFmt.format(value)} kg`
}

export function formatRupiah(value: number): string {
  return `Rp ${numberFmt.format(Math.round(value))}`
}

export function formatRupiahShort(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`
  return formatRupiah(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
}

export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return new Intl.DateTimeFormat('id-ID', opts).format(new Date(`${iso}T00:00:00`))
}

export function parseNumber(value: string): number {
  // Terima "1.250" (ribuan) maupun "26,5" (desimal)
  const cleaned = value.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/** Badge angka untuk menu sidebar Pembelian. */
export function getPembelianNavCounts(purchases: Purchase[]) {
  return {
    pencatatan: purchases.length,
    penerimaan: purchases.filter((p) => !isPurchaseReceivedForAp(p.stage)).length,
    pembayaran: purchases.filter((p) => summarize(p).outstanding > 0).length,
  }
}
