import { LOCATIONS } from '@/features/persediaan/persediaan-data'
import type { MetricCardData } from '@/features/dashboard/dashboard-data'

export type BatchStage =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'processing'
  | 'done'
  | 'rejected'
  | 'void'

export type BatchLine = {
  sku: string
  productName: string
  unit: string
  qty: number
  /** Untuk output: kategori tampilan */
  kind?: 'beras' | 'menir' | 'dedak' | 'sekam' | 'lain'
}

export type ProductionBatch = {
  id: string
  date: string
  operator: string
  stage: BatchStage
  inputSku: string
  inputName: string
  inputUnit: string
  inputQty: number
  /** Lot gabah dari penerimaan (opsional) */
  inputLotId?: string
  fromLocation: string
  processLocation: string
  toLocation: string
  outputs: BatchLine[]
  targetRendemen: number
  note: string
  submittedAt?: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectReason?: string
  startedAt?: string
  completedAt?: string
  voidedAt?: string
  voidReason?: string
  stockPosted: boolean
}

export type NewBatchInput = {
  date: string
  operator: string
  inputSku: string
  inputName: string
  inputUnit: string
  inputQty: number
  inputLotId?: string
  fromLocation: string
  processLocation: string
  toLocation: string
  outputs: BatchLine[]
  targetRendemen: number
  note: string
}

export const BATCH_STAGE_LABEL: Record<BatchStage, string> = {
  draft: 'Draft',
  submitted: 'Menunggu approve',
  approved: 'Disetujui',
  processing: 'Proses giling',
  done: 'Selesai',
  rejected: 'Ditolak',
  void: 'Dibatalkan',
}

export const PRODUKSI_LOCATIONS = [...LOCATIONS]

export const DEFAULT_OUTPUT_TEMPLATE: BatchLine[] = [
  {
    sku: 'BRS-MED',
    productName: 'Beras Medium',
    unit: 'kg',
    qty: 0,
    kind: 'beras',
  },
  {
    sku: 'MNR-01',
    productName: 'Menir',
    unit: 'kg',
    qty: 0,
    kind: 'menir',
  },
  {
    sku: 'DDK-01',
    productName: 'Dedak',
    unit: 'kg',
    qty: 0,
    kind: 'dedak',
  },
  {
    sku: 'SKM-01',
    productName: 'Sekam',
    unit: 'kg',
    qty: 0,
    kind: 'sekam',
  },
]

export function todayIso(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatQty(value: number, unit = 'kg'): string {
  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
  }).format(value)} ${unit}`
}

export function sumOutputs(batch: ProductionBatch): number {
  return batch.outputs.reduce((s, o) => s + (o.qty || 0), 0)
}

export function berasQty(batch: ProductionBatch): number {
  return batch.outputs
    .filter((o) => o.kind === 'beras' || o.sku.startsWith('BRS-'))
    .reduce((s, o) => s + (o.qty || 0), 0)
}

/** Rendemen beras % terhadap input gabah */
export function actualRendemen(batch: ProductionBatch): number {
  if (batch.inputQty <= 0) return 0
  return (berasQty(batch) / batch.inputQty) * 100
}

/** Selisih massa: output − input (ideal ≈ 0; biasanya negatif kecil karena hilang) */
export function massBalance(batch: ProductionBatch): number {
  return sumOutputs(batch) - batch.inputQty
}

export function nextBatchId(
  list: ProductionBatch[],
  date = new Date(),
  prefix = 'BAT',
): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const head = `${prefix}-${y}${m}-`
  const max = list.reduce((acc, b) => {
    if (!b.id.startsWith(head)) return acc
    const n = Number(b.id.slice(head.length))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `${head}${String(max + 1).padStart(3, '0')}`
}

export type PackRunLine = {
  sku: string
  productName: string
  unit: string
  grade?: 'A' | 'B' | 'C'
  qty: number
  bags?: number
  location: string
}

export type PackRun = {
  id: string
  batchId: string
  sourceSku: string
  lines: PackRunLine[]
  stage: 'draft' | 'posted'
  createdAt: string
  postedAt?: string
  voidedAt?: string
}

export type LotCost = {
  lotId: string
  batchId: string
  grainValue: number
  allocatedOps: number
  berasQty: number
  costPerKgBeras: number
  method: 'manual' | 'proportional'
  at: string
}

export function computeLotCost(input: {
  grainValue: number
  allocatedOps: number
  berasQty: number
  method: 'manual' | 'proportional'
  lotId: string
  batchId: string
}): LotCost {
  const berasQty = input.berasQty
  const total = input.grainValue + input.allocatedOps
  const costPerKgBeras =
    berasQty > 0 ? total / berasQty : 0
  return {
    lotId: input.lotId,
    batchId: input.batchId,
    grainValue: input.grainValue,
    allocatedOps: input.allocatedOps,
    berasQty,
    costPerKgBeras,
    method: input.method,
    at: new Date().toISOString(),
  }
}

/** Ekstrak lot dari catatan batch (fallback jika `inputLotId` kosong). */
export function resolveLotIdFromBatch(batch: ProductionBatch): string | undefined {
  if (batch.inputLotId?.trim()) return batch.inputLotId.trim()
  const match = batch.note.match(/LOT-\d{6}-\d{3}/i)
  return match ? match[0].toUpperCase() : undefined
}

export function nextPackRunId(list: PackRun[], date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const head = `PKR-${y}${m}-`
  const max = list.reduce((acc, row) => {
    if (!row.id.startsWith(head)) return acc
    const n = Number(row.id.slice(head.length))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `${head}${String(max + 1).padStart(3, '0')}`
}

export function sumPackRunOutQty(run: PackRun): number {
  return run.lines.reduce((s, line) => s + (line.qty || 0), 0)
}

export function buildBatchStats(batches: ProductionBatch[]): MetricCardData[] {
  const active = batches.filter((b) =>
    ['draft', 'submitted', 'approved', 'processing'].includes(b.stage),
  )
  const done = batches.filter((b) => b.stage === 'done')
  const waiting = batches.filter((b) => b.stage === 'submitted')
  const avgRend =
    done.length === 0
      ? 0
      : done.reduce((s, b) => s + actualRendemen(b), 0) / done.length

  return [
    {
      label: 'Batch aktif',
      value: String(active.length),
      delta: `${batches.length} total`,
      positive: true,
      spark: [3, 4, 4, 5, 5, 5, 6],
    },
    {
      label: 'Menunggu approve',
      value: String(waiting.length),
      delta: waiting.length ? 'Perlu review' : 'Kosong',
      positive: waiting.length === 0,
      spark: [1, 2, 1, 2, 1, 0, 1],
    },
    {
      label: 'Selesai',
      value: String(done.length),
      delta: 'Posted stok',
      positive: true,
      spark: [2, 2, 3, 3, 4, 4, 5],
    },
    {
      label: 'Avg rendemen',
      value: `${avgRend.toFixed(1)}%`,
      delta: 'dari batch selesai',
      positive: avgRend >= 60,
      spark: [62, 63, 61, 64, 65, 64, 66],
    },
  ]
}

export const SEED_BATCHES: ProductionBatch[] = [
  {
    id: 'BAT-202610-001',
    date: '2026-10-28',
    operator: 'Operator Produksi',
    stage: 'done',
    inputSku: 'GBH-IR64',
    inputName: 'Gabah IR64',
    inputUnit: 'kg',
    inputQty: 5_000,
    fromLocation: 'Silo 1',
    processLocation: 'Lantai Produksi',
    toLocation: 'Gudang A',
    outputs: [
      {
        sku: 'BRS-MED',
        productName: 'Beras Medium',
        unit: 'kg',
        qty: 3_250,
        kind: 'beras',
      },
      {
        sku: 'MNR-01',
        productName: 'Menir',
        unit: 'kg',
        qty: 280,
        kind: 'menir',
      },
      {
        sku: 'DDK-01',
        productName: 'Dedak',
        unit: 'kg',
        qty: 720,
        kind: 'dedak',
      },
      {
        sku: 'SKM-01',
        productName: 'Sekam',
        unit: 'kg',
        qty: 700,
        kind: 'sekam',
      },
    ],
    targetRendemen: 65,
    note: 'Batch demo selesai',
    submittedAt: '2026-10-28T02:00:00.000Z',
    approvedAt: '2026-10-28T02:10:00.000Z',
    approvedBy: 'Admin E-Gabah',
    startedAt: '2026-10-28T03:00:00.000Z',
    completedAt: '2026-10-28T08:00:00.000Z',
    stockPosted: true,
  },
  {
    id: 'BAT-202610-002',
    date: '2026-10-29',
    operator: 'Operator Produksi',
    stage: 'processing',
    inputSku: 'GBH-CIHERANG',
    inputName: 'Gabah Ciherang',
    inputUnit: 'kg',
    inputQty: 3_000,
    fromLocation: 'Gudang A',
    processLocation: 'Lantai Produksi',
    toLocation: 'Gudang A',
    outputs: [
      {
        sku: 'BRS-PREM',
        productName: 'Beras Premium 25kg',
        unit: 'sak',
        qty: 0,
        kind: 'beras',
      },
      {
        sku: 'MNR-01',
        productName: 'Menir',
        unit: 'kg',
        qty: 0,
        kind: 'menir',
      },
      {
        sku: 'DDK-01',
        productName: 'Dedak',
        unit: 'kg',
        qty: 0,
        kind: 'dedak',
      },
      {
        sku: 'SKM-01',
        productName: 'Sekam',
        unit: 'kg',
        qty: 0,
        kind: 'sekam',
      },
    ],
    targetRendemen: 66,
    note: 'Sedang digiling',
    submittedAt: '2026-10-29T01:00:00.000Z',
    approvedAt: '2026-10-29T01:15:00.000Z',
    approvedBy: 'Admin E-Gabah',
    startedAt: '2026-10-29T02:00:00.000Z',
    stockPosted: false,
  },
  {
    id: 'BAT-202610-003',
    date: '2026-10-30',
    operator: 'Operator Produksi',
    stage: 'submitted',
    inputSku: 'GBH-IR64',
    inputName: 'Gabah IR64',
    inputUnit: 'kg',
    inputQty: 2_500,
    fromLocation: 'Silo 1',
    processLocation: 'Lantai Produksi',
    toLocation: 'Gudang B',
    outputs: DEFAULT_OUTPUT_TEMPLATE.map((o) => ({
      ...o,
      qty:
        o.kind === 'beras'
          ? 1_600
          : o.kind === 'menir'
            ? 120
            : o.kind === 'dedak'
              ? 350
              : 380,
    })),
    targetRendemen: 64,
    note: 'Menunggu persetujuan admin',
    submittedAt: '2026-10-30T01:30:00.000Z',
    stockPosted: false,
  },
]
