import type { AuditLog } from '@/features/audit/audit-data'
import type { PayableRow, ReceivableRow } from '@/features/keuangan/keuangan-data'
import type { Purchase } from '@/features/pembelian/pembelian-data'
import type { ProductionBatch } from '@/features/produksi/produksi-data'
import type { StockRow } from '@/features/persediaan/persediaan-data'
import { isLowStock } from '@/features/persediaan/persediaan-data'

export type AppNotification = {
  id: string
  title: string
  meta: string
  href?: string
  unread: boolean
}

type Input = {
  stocks: StockRow[]
  payables: PayableRow[]
  receivables: ReceivableRow[]
  purchases: Purchase[]
  batches: ProductionBatch[]
  audit: AuditLog[]
  dismissed: Set<string>
}

export function buildNotifications(input: Input): AppNotification[] {
  const items: AppNotification[] = []

  for (const s of input.stocks) {
    if (!isLowStock(s)) continue
    const id = `stock-${s.sku}-${s.location}`
    items.push({
      id,
      title: `Stok rendah: ${s.name}`,
      meta: `${s.location} · ${s.qty} ${s.unit} (min ${s.minQty})`,
      href: '/app/persediaan',
      unread: !input.dismissed.has(id),
    })
  }

  for (const p of input.payables) {
    if (p.status !== 'overdue' && !(p.agingDays > 0 && p.paid < p.amount)) continue
    if (p.paid >= p.amount) continue
    if (p.agingDays <= 0 && p.status !== 'overdue') continue
    const id = `ap-${p.id}`
    items.push({
      id,
      title: `Utang jatuh tempo: ${p.supplier}`,
      meta: `${p.invoice} · aging ${p.agingDays}h`,
      href: '/app/keuangan/utang',
      unread: !input.dismissed.has(id),
    })
  }

  for (const r of input.receivables) {
    if (r.paid >= r.amount) continue
    if (r.agingDays <= 0 && r.status !== 'overdue') continue
    const id = `ar-${r.id}`
    items.push({
      id,
      title: `Piutang jatuh tempo: ${r.customer}`,
      meta: `${r.invoice} · aging ${r.agingDays}h`,
      href: '/app/keuangan/piutang',
      unread: !input.dismissed.has(id),
    })
  }

  for (const p of input.purchases) {
    if (p.voidedAt) continue
    if (p.stage === 'diajukan') {
      const id = `pb-sub-${p.id}`
      items.push({
        id,
        title: 'Pembelian menunggu approve',
        meta: p.id,
        href: `/app/pembelian?dok=${encodeURIComponent(p.id)}`,
        unread: !input.dismissed.has(id),
      })
      continue
    }
    if (p.stage === 'menunggu_selesai') {
      const id = `pb-done-${p.id}`
      items.push({
        id,
        title: 'Pembelian menunggu selesai',
        meta: p.id,
        href: `/app/pembelian/penerimaan?dok=${encodeURIComponent(p.id)}`,
        unread: !input.dismissed.has(id),
      })
      continue
    }
    if (p.stage === 'ditolak') {
      const id = `pb-rej-${p.id}`
      items.push({
        id,
        title: 'Pembelian ditolak keuangan',
        meta: p.rejectReason ? `${p.id} · ${p.rejectReason}` : p.id,
        href: `/app/pembelian?dok=${encodeURIComponent(p.id)}`,
        unread: !input.dismissed.has(id),
      })
      continue
    }
    if (p.stage !== 'ditimbang') continue
    const id = `wb-${p.id}`
    items.push({
      id,
      title: `Timbang menunggu konfirmasi`,
      meta: p.id,
      href: `/app/pembelian/penerimaan?dok=${encodeURIComponent(p.id)}`,
      unread: !input.dismissed.has(id),
    })
  }

  for (const b of input.batches) {
    if (b.stage !== 'submitted') continue
    const id = `bat-sub-${b.id}`
    items.push({
      id,
      title: `Batch menunggu approve`,
      meta: b.id,
      href: `/app/produksi?dok=${encodeURIComponent(b.id)}`,
      unread: !input.dismissed.has(id),
    })
  }

  for (const log of input.audit.slice(0, 5)) {
    const id = `aud-${log.id}`
    items.push({
      id,
      title: `Audit ${log.action}: ${log.entity}`,
      meta: `${log.entityId} · ${log.actor}`,
      href: '/app/audit',
      unread: !input.dismissed.has(id),
    })
  }

  return items.slice(0, 40)
}
