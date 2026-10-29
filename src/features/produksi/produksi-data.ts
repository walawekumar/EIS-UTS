/** Alur batch: rencana → proses (sedang giling) → selesai (hasil dicatat). */
export type BatchStatus = 'rencana' | 'proses' | 'selesai'

export type OutputKey = 'berasKepala' | 'berasPatah' | 'menir' | 'dedak' | 'sekam'

export type BatchOutputs = Record<OutputKey, number>

export type MillingLine = 'Lini 1' | 'Lini 2'

export type GrainLot = {
  id: string
  source: string // dokumen asal, mis. PB-2610-0016
  supplier: string
  kg: number // berat GKG masuk gudang
  receivedAt: string // ISO
}

export type Batch = {
  id: string
  date: string // ISO, tanggal rencana giling
  lotId: string
  inputKg: number
  line: MillingLine
  operator: string
  status: BatchStatus
  startedAt?: string // ISO
  finishedAt?: string // ISO
  outputs?: BatchOutputs
  note?: string
}

export type NewBatch = Pick<Batch, 'date' | 'lotId' | 'inputKg' | 'line' | 'operator' | 'note'>

export type BatchCalc = {
  totalOutput: number
  beras: number
  rendemen: number // % beras (kepala + patah) dari input
  headRatio: number // % beras kepala dari total beras
  loss: number // kg selisih massa (input − semua output)
  lossPct: number
  lowYield: boolean
  lossHigh: boolean
}

/** Rendemen giling GKG → beras minimal yang diharapkan. */
export const RENDEMEN_TARGET = 62 // %
/** Batas wajar selisih massa (debu, tercecer, penguapan). */
export const LOSS_TOLERANCE = 2 // %

export const OUTPUTS: { key: OutputKey; label: string; tone: string; typicalPct: number; main: boolean }[] = [
  { key: 'berasKepala', label: 'Beras kepala', tone: 'bg-brand-700', typicalPct: 55, main: true },
  { key: 'berasPatah', label: 'Beras patah', tone: 'bg-brand-400', typicalPct: 8, main: true },
  { key: 'menir', label: 'Menir', tone: 'bg-amber-400', typicalPct: 2, main: false },
  { key: 'dedak', label: 'Dedak', tone: 'bg-amber-700', typicalPct: 10, main: false },
  { key: 'sekam', label: 'Sekam', tone: 'bg-stone-400', typicalPct: 23.5, main: false },
]

export const LOSS_TONE = 'bg-red-300'

export const MILLING_LINES: MillingLine[] = ['Lini 1', 'Lini 2']

export const OPERATORS = ['Slamet', 'Wahyu', 'Agus']

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  rencana: 'Direncanakan',
  proses: 'Sedang giling',
  selesai: 'Selesai',
}

// Lot GKG di gudang, berasal dari penerimaan pembelian
export const GRAIN_LOTS: GrainLot[] = [
  { id: 'LOT-1001', source: 'Saldo awal Oktober', supplier: 'Gabungan pemasok', kg: 4500, receivedAt: '2026-10-01' },
  { id: 'LOT-1020', source: 'PB-2610-0013', supplier: 'Koperasi Tani Sejahtera', kg: 1722, receivedAt: '2026-10-20' },
  { id: 'LOT-1025', source: 'PB-2610-0014', supplier: 'UD Tani Makmur', kg: 2174, receivedAt: '2026-10-25' },
  { id: 'LOT-1026', source: 'Pengeringan PB-2610-0015', supplier: 'Kelompok Tani Sri Rejeki', kg: 1560, receivedAt: '2026-10-27' },
  { id: 'LOT-1027', source: 'PB-2610-0016', supplier: 'Koperasi Tani Sejahtera', kg: 3000, receivedAt: '2026-10-27' },
  { id: 'LOT-1028', source: 'PB-2610-0018', supplier: 'UD Tani Makmur', kg: 1184, receivedAt: '2026-10-28' },
]

export function getLot(id: string): GrainLot | undefined {
  return GRAIN_LOTS.find((l) => l.id === id)
}

/** Sisa GKG di lot setelah dipakai batch (kecuali batch yang dikecualikan). */
export function lotAvailable(lotId: string, batches: Batch[], excludeBatchId?: string): number {
  const lot = getLot(lotId)
  if (!lot) return 0
  const used = batches
    .filter((b) => b.lotId === lotId && b.id !== excludeBatchId)
    .reduce((sum, b) => sum + b.inputKg, 0)
  return Math.max(0, lot.kg - used)
}

export function sumOutputs(outputs: Partial<BatchOutputs>): number {
  return OUTPUTS.reduce((sum, o) => sum + (outputs[o.key] ?? 0), 0)
}

export function calcBatch(inputKg: number, outputs: Partial<BatchOutputs>): BatchCalc {
  const totalOutput = sumOutputs(outputs)
  const beras = (outputs.berasKepala ?? 0) + (outputs.berasPatah ?? 0)
  const rendemen = inputKg > 0 ? (beras / inputKg) * 100 : 0
  const loss = inputKg - totalOutput
  const lossPct = inputKg > 0 ? (loss / inputKg) * 100 : 0
  return {
    totalOutput,
    beras,
    rendemen,
    headRatio: beras > 0 ? ((outputs.berasKepala ?? 0) / beras) * 100 : 0,
    loss,
    lossPct,
    lowYield: beras > 0 && rendemen < RENDEMEN_TARGET,
    lossHigh: loss < 0 || lossPct > LOSS_TOLERANCE,
  }
}

/** Perkiraan hasil berdasarkan persentase tipikal penggilingan GKG. */
export function estimateOutputs(inputKg: number): BatchOutputs {
  return Object.fromEntries(
    OUTPUTS.map((o) => [o.key, Math.round((inputKg * o.typicalPct) / 100)]),
  ) as BatchOutputs
}

export function needsReview(b: Batch): boolean {
  if (b.status !== 'selesai' || !b.outputs) return false
  const c = calcBatch(b.inputKg, b.outputs)
  return c.lowYield || c.lossHigh
}

export function nextBatchId(items: Batch[], date = new Date()): string {
  const yymm = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}`
  const prefix = `BAT-${yymm}-`
  const max = items
    .filter((b) => b.id.startsWith(prefix))
    .reduce((m, b) => Math.max(m, Number(b.id.slice(prefix.length)) || 0), 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export const INITIAL_BATCHES: Batch[] = [
  { id: 'BAT-2610-0007', date: '2026-10-30', lotId: 'LOT-1028', inputKg: 1184, line: 'Lini 1', operator: 'Agus', status: 'rencana' },
  { id: 'BAT-2610-0006', date: '2026-10-29', lotId: 'LOT-1026', inputKg: 1000, line: 'Lini 2', operator: 'Wahyu', status: 'rencana', note: 'Tunggu Lini 2 selesai dibersihkan' },
  { id: 'BAT-2610-0005', date: '2026-10-29', lotId: 'LOT-1027', inputKg: 1500, line: 'Lini 1', operator: 'Slamet', status: 'proses', startedAt: '2026-10-29' },
  { id: 'BAT-2610-0004', date: '2026-10-28', lotId: 'LOT-1027', inputKg: 1500, line: 'Lini 2', operator: 'Wahyu', status: 'selesai', startedAt: '2026-10-28', finishedAt: '2026-10-28',
    outputs: { berasKepala: 840, berasPatah: 117, menir: 30, dedak: 150, sekam: 341 } },
  { id: 'BAT-2610-0003', date: '2026-10-26', lotId: 'LOT-1025', inputKg: 950, line: 'Lini 1', operator: 'Slamet', status: 'selesai', startedAt: '2026-10-26', finishedAt: '2026-10-26',
    outputs: { berasKepala: 497, berasPatah: 84, menir: 21, dedak: 95, sekam: 236 }, note: 'Gabah agak lembap, rendemen turun' },
  { id: 'BAT-2610-0002', date: '2026-10-24', lotId: 'LOT-1025', inputKg: 1200, line: 'Lini 2', operator: 'Wahyu', status: 'selesai', startedAt: '2026-10-24', finishedAt: '2026-10-24',
    outputs: { berasKepala: 642, berasPatah: 102, menir: 26, dedak: 122, sekam: 281 } },
  { id: 'BAT-2610-0001', date: '2026-10-21', lotId: 'LOT-1020', inputKg: 1700, line: 'Lini 1', operator: 'Slamet', status: 'selesai', startedAt: '2026-10-21', finishedAt: '2026-10-21',
    outputs: { berasKepala: 935, berasPatah: 136, menir: 34, dedak: 170, sekam: 398 } },
]
