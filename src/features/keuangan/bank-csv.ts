import type { BankLine } from '@/features/keuangan/bank-data'

export type ParsedBankLineDraft = Omit<
  BankLine,
  'id' | 'sessionId' | 'status'
>

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

function parseDateCell(raw: string): string | undefined {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  const day = Number(m[1])
  const month = Number(m[2])
  const y = Number(m[3])
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const iso = `${y}-${mm}-${dd}`
  const d = new Date(`${iso}T12:00:00`)
  if (
    d.getFullYear() !== y ||
    d.getMonth() + 1 !== month ||
    d.getDate() !== day
  ) {
    return undefined
  }
  return iso
}

function parseRupiah(raw: string): number | undefined {
  let s = raw.trim()
  if (!s) return undefined
  s = s.replace(/\s/g, '').replace(/^Rp\.?/i, '')
  const negative = s.startsWith('-') || s.startsWith('(')
  s = s.replace(/[()\-+]/g, '')
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`
    } else {
      s = s.replace(/,/g, '')
    }
  } else {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return undefined
  return Math.round(negative ? -n : n)
}

type ColMap = {
  date?: number
  memo?: number
  amount?: number
  debit?: number
  credit?: number
  ref?: number
}

function mapHeaders(headers: string[]): ColMap {
  const map: ColMap = {}
  headers.forEach((h, i) => {
    const n = normalizeHeader(h)
    if (['date', 'tanggal', 'tgl'].includes(n)) map.date = i
    else if (
      ['description', 'deskripsi', 'memo', 'keterangan', 'uraian'].includes(n)
    ) {
      map.memo = i
    } else if (['amount', 'jumlah', 'nominal'].includes(n)) map.amount = i
    else if (['debit', 'debet', 'masuk'].includes(n)) map.debit = i
    else if (['credit', 'kredit', 'keluar'].includes(n)) map.credit = i
    else if (['ref', 'reference', 'no', 'referensi'].includes(n)) map.ref = i
  })
  return map
}

function signedAmountFromRow(
  cells: string[],
  map: ColMap,
): number | undefined {
  if (map.amount != null) {
    return parseRupiah(cells[map.amount] ?? '')
  }
  const debit = map.debit != null ? parseRupiah(cells[map.debit] ?? '') : undefined
  const credit =
    map.credit != null ? parseRupiah(cells[map.credit] ?? '') : undefined
  if (debit == null && credit == null) return undefined
  const d = debit ?? 0
  const c = credit ?? 0
  if (d !== 0 && c !== 0) return d - c
  if (d !== 0) return d
  if (c !== 0) return -Math.abs(c)
  return 0
}

export function parseBankCsv(text: string): {
  lines: ParsedBankLineDraft[]
  error?: string
} {
  const trimmed = text.trim()
  if (!trimmed) {
    return { lines: [], error: 'File CSV kosong.' }
  }
  const rows = parseCsvRows(trimmed)
  if (rows.length < 2) {
    return { lines: [], error: 'CSV harus punya header dan minimal satu baris.' }
  }
  const map = mapHeaders(rows[0])
  if (map.date == null) {
    return { lines: [], error: 'Kolom tanggal (date/tanggal) tidak ditemukan.' }
  }
  if (map.memo == null) {
    return { lines: [], error: 'Kolom deskripsi tidak ditemukan.' }
  }
  if (map.amount == null && map.debit == null && map.credit == null) {
    return {
      lines: [],
      error: 'Kolom jumlah atau debit/kredit tidak ditemukan.',
    }
  }

  const lines: ParsedBankLineDraft[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const date = parseDateCell(cells[map.date] ?? '')
    const amount = signedAmountFromRow(cells, map)
    if (date == null || amount == null || amount === 0) continue
    const memo = (cells[map.memo] ?? '').trim() || '—'
    const bankRef =
      map.ref != null ? (cells[map.ref] ?? '').trim() || undefined : undefined
    lines.push({ date, memo, amount, bankRef })
  }

  if (lines.length === 0) {
    return {
      lines: [],
      error: 'Tidak ada baris valid — periksa format tanggal dan jumlah.',
    }
  }
  return { lines }
}
