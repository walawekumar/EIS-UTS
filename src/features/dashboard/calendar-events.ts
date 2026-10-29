export type CalendarEventTone = 'deadline' | 'ops' | 'info'

export type CalendarEvent = {
  id: string
  title: string
  meta: string
  tone: CalendarEventTone
  /** offset hari relatif terhadap hari ini: 0 = hari ini, -1 kemarin, 1 besok */
  dayOffset: number
}

/** Contoh agenda MVP — relatif ke tanggal hari ini agar selalu relevan */
export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Konfirmasi penerimaan RCV-0241',
    meta: 'Deadline · Pembelian',
    tone: 'deadline',
    dayOffset: 0,
  },
  {
    id: 'e2',
    title: 'QC batch BAT-0189',
    meta: 'Operasional · Produksi',
    tone: 'ops',
    dayOffset: 0,
  },
  {
    id: 'e3',
    title: 'Piutang DO-0912 jatuh tempo',
    meta: 'Deadline · Keuangan',
    tone: 'deadline',
    dayOffset: 1,
  },
  {
    id: 'e4',
    title: 'Cek kapasitas Gudang A',
    meta: 'Operasional · Gudang',
    tone: 'ops',
    dayOffset: 1,
  },
  {
    id: 'e5',
    title: 'Bayar utang pemasok CV Tani',
    meta: 'Deadline · Rp 4,5 jt',
    tone: 'deadline',
    dayOffset: 2,
  },
  {
    id: 'e6',
    title: 'Kirim DO-0915 ke Mitra Beras',
    meta: 'Operasional · Penjualan',
    tone: 'ops',
    dayOffset: 3,
  },
  {
    id: 'e7',
    title: 'Laporan rendemen mingguan',
    meta: 'Info · Produksi',
    tone: 'info',
    dayOffset: -1,
  },
  {
    id: 'e8',
    title: 'Koreksi stok ADJ-0077',
    meta: 'Deadline · Gudang',
    tone: 'deadline',
    dayOffset: -2,
  },
  {
    id: 'e9',
    title: 'Meeting koordinasi stok',
    meta: 'Info · Internal',
    tone: 'info',
    dayOffset: 5,
  },
  {
    id: 'e10',
    title: 'Tagihan SO-1102 jatuh tempo',
    meta: 'Deadline · Penjualan',
    tone: 'deadline',
    dayOffset: 7,
  },
]

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function buildEventMap(
  events: CalendarEvent[] = CALENDAR_EVENTS,
  base = new Date(),
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate())

  for (const event of events) {
    const date = new Date(start)
    date.setDate(start.getDate() + event.dayOffset)
    const key = dateKey(date)
    const list = map.get(key) ?? []
    list.push(event)
    map.set(key, list)
  }

  return map
}
