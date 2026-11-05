import type { CashEntry } from '@/features/keuangan/keuangan-data'
import { todayIsoDate } from '@/features/keuangan/period-helpers'
import type { Purchase } from '@/features/pembelian/pembelian-data'
import {
  isPurchaseReceivedForAp,
  summarize as summarizePurchase,
} from '@/features/pembelian/pembelian-data'
import type { SaleOrder } from '@/features/penjualan/penjualan-data'
import { summarize as summarizeSale } from '@/features/penjualan/penjualan-data'

export type ChartRange = '7d' | '30d' | '12m'

export type OpsTrend = {
  labels: string[]
  series: { name: string; color: string; values: number[] }[]
  unit: string
  title: string
}

const ID_MONTH: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  Mei: '05',
  Jun: '06',
  Jul: '07',
  Agu: '08',
  Sep: '09',
  Okt: '10',
  Nov: '11',
  Des: '12',
}

/** Accept ISO `YYYY-MM-DD` or legacy `29 Okt 2026`. */
function dayKey(raw: string): string {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const month = ID_MONTH[m[2]]
    if (month) return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
  }
  return s.slice(0, 10)
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return dayKey(d.toISOString())
}

function todayKey(): string {
  return todayIsoDate()
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
  }).format(d)
}

function formatMonthLabel(ym: string): string {
  const d = new Date(`${ym}-01T12:00:00`)
  return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d)
}

function toJt(n: number): number {
  // Keep sub-million activity visible (0.1 jt) so the chart is not blank.
  return Math.max(0, Math.round((n / 1_000_000) * 10) / 10)
}

function bucketsFor(range: ChartRange): { key: string; label: string }[] {
  const today = todayKey()
  if (range === '7d') {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i - 6)
      return { key, label: formatDayLabel(key) }
    })
  }
  if (range === '30d') {
    return Array.from({ length: 30 }, (_, i) => {
      const key = addDays(today, i - 29)
      return { key, label: String(Number(key.slice(8, 10))) }
    })
  }
  const now = new Date(`${today}T12:00:00`)
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: formatMonthLabel(key) }
  })
}

function keyFor(date: string, range: ChartRange): string {
  return range === '12m' ? monthKey(date) : dayKey(date)
}

export function buildOpsTrend(input: {
  range: ChartRange
  purchases: Purchase[]
  orders: SaleOrder[]
  cash: CashEntry[]
}): OpsTrend {
  const buckets = bucketsFor(input.range)
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  const beli = new Array(buckets.length).fill(0) as number[]
  const jual = new Array(buckets.length).fill(0) as number[]
  const kasIn = new Array(buckets.length).fill(0) as number[]

  for (const p of input.purchases) {
    if (p.voidedAt || !isPurchaseReceivedForAp(p.stage)) continue
    const i = index.get(keyFor(p.date, input.range))
    if (i == null) continue
    beli[i] += summarizePurchase(p).total
  }

  for (const o of input.orders) {
    if (o.voidedAt) continue
    // Count all active orders so new SO fill the chart before shipping.
    const i = index.get(keyFor(o.date, input.range))
    if (i == null) continue
    jual[i] += summarizeSale(o).total
  }

  for (const c of input.cash) {
    if (c.direction !== 'in') continue
    const i = index.get(keyFor(c.date, input.range))
    if (i == null) continue
    kasIn[i] += c.amount
  }

  const title =
    input.range === '7d'
      ? '7 hari terakhir'
      : input.range === '30d'
        ? '30 hari terakhir'
        : '12 bulan terakhir'

  return {
    title,
    unit: 'jt Rp',
    labels: buckets.map((b) => b.label),
    series: [
      { name: 'Beli', color: '#3f7d2e', values: beli.map(toJt) },
      { name: 'Jual', color: '#1a4d36', values: jual.map(toJt) },
      { name: 'Kas masuk', color: '#2a7a58', values: kasIn.map(toJt) },
    ],
  }
}
