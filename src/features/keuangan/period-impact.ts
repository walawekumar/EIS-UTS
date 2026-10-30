import {
  isoInRange,
  parseCashDateToIso,
} from '@/features/keuangan/period-helpers'
import type { UnlockImpactRole } from '@/features/keuangan/period-data'

export type ImpactSources = {
  startDate: string
  endDate: string
  saleOrders: { date: string; voidedAt?: string }[]
  saleReturns: { postedAt?: string; stage: string }[]
  purchases: { date: string; voidedAt?: string }[]
  purchaseReturns: { postedAt?: string; stage: string }[]
  batches: {
    startedAt?: string
    completedAt?: string
    date?: string
    stage: string
  }[]
  packRuns: { postedAt?: string; stage: string }[]
  stockMovements: { date: string }[]
  cashEntries: { date: string }[]
  expenses: { date: string; status: string }[]
  journals: { date: string }[]
  payrollRuns: { postedAt?: string; status: string }[]
}

function toIso(d: string): string | undefined {
  return (
    parseCashDateToIso(d) ??
    (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined)
  )
}

function anyIsoInRange(
  isos: (string | undefined)[],
  start: string,
  end: string,
): boolean {
  return isos.some((i) => i != null && isoInRange(i, start, end))
}

export function computeRequiredRoles(src: ImpactSources): UnlockImpactRole[] {
  const { startDate: s, endDate: e } = src
  const roles = new Set<UnlockImpactRole>()

  if (
    src.saleOrders.some((o) => {
      if (o.voidedAt) return false
      const iso = toIso(o.date)
      return iso != null && isoInRange(iso, s, e)
    }) ||
    src.saleReturns.some(
      (r) =>
        r.stage === 'posted' &&
        r.postedAt != null &&
        isoInRange(r.postedAt.slice(0, 10), s, e),
    )
  ) {
    roles.add('penjualan')
  }

  if (
    src.purchases.some((p) => {
      if (p.voidedAt) return false
      const iso = toIso(p.date)
      return iso != null && isoInRange(iso, s, e)
    }) ||
    src.purchaseReturns.some(
      (r) =>
        r.stage === 'posted' &&
        r.postedAt != null &&
        isoInRange(r.postedAt.slice(0, 10), s, e),
    )
  ) {
    roles.add('pembelian')
  }

  if (
    src.batches.some((b) => {
      if (b.stage === 'void') return false
      return anyIsoInRange(
        [
          b.startedAt?.slice(0, 10),
          b.completedAt?.slice(0, 10),
          b.date ? toIso(b.date) : undefined,
        ],
        s,
        e,
      )
    }) ||
    src.packRuns.some(
      (p) =>
        p.stage === 'posted' &&
        p.postedAt != null &&
        isoInRange(p.postedAt.slice(0, 10), s, e),
    )
  ) {
    roles.add('produksi')
  }

  if (
    src.stockMovements.some((m) => {
      const iso = toIso(m.date)
      return iso != null && isoInRange(iso, s, e)
    })
  ) {
    roles.add('gudang')
  }

  const financeHit =
    src.cashEntries.some((c) => {
      const iso = toIso(c.date)
      return iso != null && isoInRange(iso, s, e)
    }) ||
    src.expenses.some((x) => {
      if (x.status !== 'posted') return false
      const iso = toIso(x.date)
      return iso != null && isoInRange(iso, s, e)
    }) ||
    src.journals.some((j) => isoInRange(j.date, s, e)) ||
    src.payrollRuns.some(
      (r) =>
        r.status === 'posted' &&
        r.postedAt != null &&
        isoInRange(r.postedAt.slice(0, 10), s, e),
    )

  if (financeHit) roles.add('keuangan')

  return [...roles]
}
