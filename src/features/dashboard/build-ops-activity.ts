import type { ActivityRow } from '@/features/dashboard/dashboard-data'
import type { CashEntry } from '@/features/keuangan/keuangan-data'
import { formatIdr } from '@/features/keuangan/keuangan-data'
import type { Purchase } from '@/features/pembelian/pembelian-data'
import {
  isPurchaseReceivedForAp,
  summarize as summarizePurchase,
} from '@/features/pembelian/pembelian-data'
import type { SaleOrder } from '@/features/penjualan/penjualan-data'
import { summarize as summarizeSale } from '@/features/penjualan/penjualan-data'
import type { ProductionBatch } from '@/features/produksi/produksi-data'

function formatWhen(iso: string): string {
  const raw = iso.length === 10 ? `${iso}T12:00:00` : iso
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function sortKey(iso: string): string {
  return iso.length === 10 ? `${iso}T12:00:00` : iso
}

/** Feed dokumen operasional — bukan audit log mentah. */
export function buildOpsActivity(input: {
  purchases: Purchase[]
  orders: SaleOrder[]
  batches: ProductionBatch[]
  cash: CashEntry[]
  /** Kosong = semua jenis. Isi untuk membatasi sesuai peran. */
  include?: {
    purchase?: boolean
    sale?: boolean
    batch?: boolean
    cash?: boolean
  }
}): ActivityRow[] {
  const allow = input.include
  const rows: Array<ActivityRow & { _sort: string }> = []

  if (!allow || allow.purchase) {
  for (const p of input.purchases) {
    if (p.voidedAt) continue
    const status: ActivityRow['status'] =
      p.stage === 'draft' || p.stage === 'diajukan'
        ? 'draft'
        : isPurchaseReceivedForAp(p.stage)
          ? 'ok'
          : 'warn'
    rows.push({
      _sort: sortKey(p.date),
      date: formatWhen(p.date),
      type: 'Pembelian',
      reference: p.id,
      amount: formatIdr(summarizePurchase(p).total),
      status,
      actor: p.vehicle || 'Pembelian',
    })
  }
  }

  if (!allow || allow.sale) {
  for (const o of input.orders) {
    if (o.voidedAt) continue
    const status: ActivityRow['status'] =
      o.stage === 'dibuat'
        ? 'draft'
        : o.stage === 'dikirim'
          ? 'ok'
          : 'warn'
    rows.push({
      _sort: sortKey(o.date),
      date: formatWhen(o.date),
      type: 'Penjualan',
      reference: o.id,
      amount: formatIdr(summarizeSale(o).total),
      status,
      actor: 'Penjualan',
    })
  }
  }

  if (!allow || allow.batch) {
  for (const b of input.batches) {
    if (b.voidedAt) continue
    const status: ActivityRow['status'] =
      b.stage === 'draft' || b.stage === 'submitted'
        ? 'draft'
        : b.stage === 'done'
          ? 'ok'
          : 'warn'
    rows.push({
      _sort: sortKey(b.date),
      date: formatWhen(b.date),
      type: 'Produksi',
      reference: b.id,
      amount: `${b.inputQty.toLocaleString('id-ID')} ${b.inputUnit}`,
      status,
      actor: b.operator || 'Produksi',
    })
  }
  }

  if (!allow || allow.cash) {
  for (const c of input.cash.slice(0, 20)) {
    rows.push({
      _sort: sortKey(c.date),
      date: formatWhen(c.date),
      type: c.direction === 'in' ? 'Kas masuk' : 'Kas keluar',
      reference: c.reference || c.id,
      amount: formatIdr(c.amount),
      status: 'ok',
      actor: c.actor || 'Keuangan',
    })
  }
  }

  return rows
    .sort((a, b) => b._sort.localeCompare(a._sort))
    .slice(0, 12)
    .map(({ _sort: _, ...row }) => row)
}
