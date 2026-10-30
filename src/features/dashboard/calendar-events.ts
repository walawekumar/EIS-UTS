import {
  isPurchaseReceivedForAp,
  type LotQc,
  type Purchase,
} from '@/features/pembelian/pembelian-data'
import type { SaleOrder } from '@/features/penjualan/penjualan-data'
import type { ProductionBatch } from '@/features/produksi/produksi-data'
import type {
  PayableRow,
  ReceivableRow,
} from '@/features/keuangan/keuangan-data'
import type { PeriodLock } from '@/features/keuangan/period-data'
import { parseCashDateToIso } from '@/features/keuangan/period-helpers'

export type CalendarEventTone = 'deadline' | 'ops' | 'info'

export type CalendarEvent = {
  id: string
  title: string
  meta: string
  tone: CalendarEventTone
  /** Absolute calendar day YYYY-MM-DD */
  date: string
}

export type OpsCalendarInput = {
  purchases: Purchase[]
  orders: SaleOrder[]
  batches: ProductionBatch[]
  lotQc: LotQc[]
  payables: PayableRow[]
  receivables: ReceivableRow[]
  periodLocks: PeriodLock[]
}

function isoDay(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return parseCashDateToIso(t)
}

/** Bangun agenda dashboard dari data operasional (bukan hardcode). */
export function buildOpsCalendarEvents(
  input: OpsCalendarInput,
): CalendarEvent[] {
  const out: CalendarEvent[] = []

  for (const p of input.purchases) {
    if (p.voidedAt) continue
    const due = isoDay(p.dueDate)
    if (due) {
      out.push({
        id: `po-due-${p.id}`,
        title: `Jatuh tempo PO ${p.id}`,
        meta: 'Deadline · Pembelian',
        tone: 'deadline',
        date: due,
      })
    }
    if (p.lotId && isPurchaseReceivedForAp(p.stage)) {
      const qc = input.lotQc.find((q) => q.lotId === p.lotId)
      if (!qc) {
        const d = isoDay(p.date) ?? due
        if (d) {
          out.push({
            id: `qc-pending-${p.lotId}`,
            title: `QC lot ${p.lotId}`,
            meta: 'Operasional · Pembelian',
            tone: 'ops',
            date: d,
          })
        }
      }
    }
  }

  for (const o of input.orders) {
    if (o.voidedAt) continue
    const due = isoDay(o.dueDate)
    if (due) {
      out.push({
        id: `so-due-${o.id}`,
        title: `Jatuh tempo SO ${o.id}`,
        meta: 'Deadline · Penjualan',
        tone: 'deadline',
        date: due,
      })
    }
  }

  for (const b of input.batches) {
    if (b.stage === 'done' || b.stage === 'void') continue
    const d = isoDay(b.date)
    if (d) {
      out.push({
        id: `batch-${b.id}`,
        title: `Batch ${b.id} berjalan`,
        meta: 'Operasional · Produksi',
        tone: 'ops',
        date: d,
      })
    }
  }

  for (const row of input.payables) {
    if (row.status === 'paid') continue
    const due = isoDay(row.dueDate)
    if (due) {
      out.push({
        id: `ap-${row.id}`,
        title: `Utang ${row.supplier}`,
        meta: `Deadline · ${row.invoice}`,
        tone: 'deadline',
        date: due,
      })
    }
  }

  for (const row of input.receivables) {
    if (row.status === 'paid') continue
    const due = isoDay(row.dueDate)
    if (due) {
      out.push({
        id: `ar-${row.id}`,
        title: `Piutang ${row.customer}`,
        meta: `Deadline · ${row.invoice}`,
        tone: 'deadline',
        date: due,
      })
    }
  }

  for (const lock of input.periodLocks) {
    if (!lock.active) continue
    out.push({
      id: `lock-start-${lock.id}`,
      title: `Periode terkunci ${lock.kind === 'month' && lock.yearMonth ? lock.yearMonth : lock.startDate}`,
      meta: 'Info · Tutup buku',
      tone: 'info',
      date: lock.startDate,
    })
    if (lock.endDate !== lock.startDate) {
      out.push({
        id: `lock-end-${lock.id}`,
        title: `Akhir kunci ${lock.endDate}`,
        meta: 'Info · Tutup buku',
        tone: 'info',
        date: lock.endDate,
      })
    }
  }

  return out.sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    if (d !== 0) return d
    return a.id.localeCompare(b.id)
  })
}

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function buildEventMap(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const key = event.date
    const list = map.get(key) ?? []
    list.push(event)
    map.set(key, list)
  }
  return map
}
