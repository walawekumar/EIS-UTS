import type { PeriodLock } from '@/features/keuangan/period-data'

const ID_MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  Mei: 4,
  Jun: 5,
  Jul: 6,
  Agu: 7,
  Sep: 8,
  Okt: 9,
  Nov: 10,
  Des: 11,
}

/** "30 Okt 2026" | already ISO → YYYY-MM-DD; else undefined */
export function parseCashDateToIso(raw: string): string | undefined {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!m) return undefined
  const month = ID_MONTHS[m[2]]
  if (month == null) return undefined
  const day = Number(m[1])
  const y = Number(m[3])
  const d = new Date(y, month, day)
  if (d.getFullYear() !== y || d.getMonth() !== month || d.getDate() !== day) {
    return undefined
  }
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export function todayIsoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthBounds(yearMonth: string): {
  startDate: string
  endDate: string
} {
  const [ys, ms] = yearMonth.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const startDate = `${ys}-${ms}-01`
  const last = new Date(y, m, 0).getDate()
  const endDate = `${ys}-${ms}-${String(last).padStart(2, '0')}`
  return { startDate, endDate }
}

export function isoInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end
}

export function locksOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

export function assertPeriodOpenAgainst(
  locks: PeriodLock[],
  isoDate: string,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return `Tanggal tidak valid untuk kunci periode: ${isoDate}`
  }
  const hit = locks.find(
    (l) => l.active && isoInRange(isoDate, l.startDate, l.endDate),
  )
  if (!hit) return undefined
  const label =
    hit.kind === 'month' && hit.yearMonth
      ? hit.yearMonth
      : `${hit.startDate}–${hit.endDate}`
  return `Periode terkunci (${label}). Buat permintaan unlock dan tunggu persetujuan.`
}
