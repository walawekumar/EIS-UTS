import {
  MOVEMENT_LABEL,
  formatQty,
  type CorrectionRow,
  type MovementRow,
  type StockRow,
} from '@/features/persediaan/persediaan-data'

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  mei: 4,
  jun: 5,
  jul: 6,
  agu: 7,
  sep: 8,
  okt: 9,
  nov: 10,
  des: 11,
}

/** Parse label tampilan "29 Okt 2026" → Date (lokal, tengah hari). */
export function parseDisplayDate(label: string): Date | null {
  const m = label.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!m) return null
  const day = Number(m[1])
  const mon = MONTH_INDEX[m[2].toLowerCase().slice(0, 3)]
  const year = Number(m[3])
  if (mon === undefined || Number.isNaN(day) || Number.isNaN(year)) return null
  return new Date(year, mon, day, 12, 0, 0, 0)
}

export function inDateRange(
  displayDate: string,
  fromIso: string,
  toIso: string,
): boolean {
  const d = parseDisplayDate(displayDate)
  if (!d) return true
  if (fromIso) {
    const from = new Date(`${fromIso}T00:00:00`)
    if (d < from) return false
  }
  if (toIso) {
    const to = new Date(`${toIso}T23:59:59`)
    if (d > to) return false
  }
  return true
}

export type StockLedgerEntry = {
  id: string
  date: string
  kind: 'mutasi' | 'koreksi'
  reference: string
  label: string
  delta: number
  unit: string
  note: string
  status?: string
}

export function buildStockLedger(
  stock: StockRow,
  movements: MovementRow[],
  corrections: CorrectionRow[],
): StockLedgerEntry[] {
  const mutasi: StockLedgerEntry[] = []

  for (const row of movements) {
    if (row.sku !== stock.sku) continue
    let delta = 0
    if (row.type === 'in' && row.toLocation === stock.location) {
      delta = row.qty
    } else if (row.type === 'out' && row.fromLocation === stock.location) {
      delta = -row.qty
    } else if (row.type === 'transfer') {
      if (row.fromLocation === stock.location) delta = -row.qty
      else if (row.toLocation === stock.location) delta = row.qty
    }
    if (delta === 0) continue
    mutasi.push({
      id: row.id,
      date: row.date,
      kind: 'mutasi',
      reference: row.reference,
      label: MOVEMENT_LABEL[row.type],
      delta,
      unit: row.unit,
      note: row.note,
    })
  }

  const koreksi: StockLedgerEntry[] = corrections
    .filter((r) => r.sku === stock.sku && r.location === stock.location)
    .map((r) => ({
      id: r.id,
      date: r.date,
      kind: 'koreksi' as const,
      reference: r.reference,
      label: 'Koreksi',
      delta: r.afterQty - r.beforeQty,
      unit: r.unit,
      note: r.reason,
      status: r.status,
    }))

  return [...mutasi, ...koreksi].sort((a, b) => {
    const da = parseDisplayDate(a.date)?.getTime() ?? 0
    const db = parseDisplayDate(b.date)?.getTime() ?? 0
    return db - da
  })
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const escape = (cell: string | number) => {
    const s = String(cell)
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportSaldoCsv(rows: StockRow[]) {
  downloadCsv(
    `saldo-stok-${new Date().toISOString().slice(0, 10)}.csv`,
    ['SKU', 'Nama', 'Kategori', 'Lokasi', 'Saldo', 'Min', 'Unit', 'Diperbarui'],
    rows.map((r) => [
      r.sku,
      r.name,
      r.category,
      r.location,
      r.qty,
      r.minQty,
      r.unit,
      r.updatedAt,
    ]),
  )
}

export function exportMutasiCsv(rows: MovementRow[]) {
  downloadCsv(
    `mutasi-stok-${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'Referensi',
      'Tanggal',
      'Jenis',
      'SKU',
      'Produk',
      'Dari',
      'Ke',
      'Jumlah',
      'Unit',
      'Keterangan',
      'Oleh',
    ],
    rows.map((r) => [
      r.reference,
      r.date,
      MOVEMENT_LABEL[r.type],
      r.sku,
      r.productName,
      r.fromLocation,
      r.toLocation,
      r.qty,
      r.unit,
      r.note,
      r.actor,
    ]),
  )
}

export function formatDelta(delta: number, unit: string): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatQty(delta, unit)}`
}
