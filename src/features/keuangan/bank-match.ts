import type { CashEntry } from '@/features/keuangan/keuangan-data'
import { parseCashDateToIso } from '@/features/keuangan/period-helpers'

const DAY_MS = 86_400_000

function daysApart(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00`).getTime()
  const b = new Date(`${bIso}T00:00:00`).getTime()
  return Math.round(Math.abs(a - b) / DAY_MS)
}

/** Cash in = +amount, out = -amount for compare to bank signed amount */
export function cashSignedAmount(e: CashEntry): number {
  return e.direction === 'in' ? e.amount : -e.amount
}

export function suggestMatches(
  unmatched: { id: string; date: string; amount: number }[],
  cashEntries: CashEntry[],
  takenCashIds: Set<string>,
): Map<string, string> {
  const out = new Map<string, string>()
  const pool = cashEntries.filter((c) => !takenCashIds.has(c.id))
  for (const line of unmatched) {
    const hit = pool.find((c) => {
      const cIso = parseCashDateToIso(c.date)
      if (!cIso) return false
      if (cashSignedAmount(c) !== line.amount) return false
      return daysApart(line.date, cIso) <= 2
    })
    if (hit) {
      out.set(line.id, hit.id)
      takenCashIds.add(hit.id)
      const idx = pool.findIndex((p) => p.id === hit.id)
      if (idx >= 0) pool.splice(idx, 1)
    }
  }
  return out
}
