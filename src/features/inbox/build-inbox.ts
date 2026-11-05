import type { InboxItem } from '@/features/inbox/inbox-data'
import type { UnlockRequest } from '@/features/keuangan/period-data'
import type { PeriodLock } from '@/features/keuangan/period-data'
import {
  summarize,
  type Purchase,
  type PurchaseReturn,
} from '@/features/pembelian/pembelian-data'
import type { SaleReturn } from '@/features/penjualan/penjualan-data'
import { runTotal, type PayrollRun } from '@/features/payroll/payroll-data'
import type { ProductionBatch } from '@/features/produksi/produksi-data'
import type { UserRole } from '@/types/auth'

export type InboxSources = {
  role: UserRole
  saleReturns: SaleReturn[]
  purchaseReturns: PurchaseReturn[]
  purchases: Purchase[]
  batches: ProductionBatch[]
  payrollRuns: PayrollRun[]
  unlockRequests: UnlockRequest[]
  periodLocks: PeriodLock[]
}

function visibleTo(role: UserRole, actors: UserRole[]): boolean {
  return role === 'admin' || actors.includes(role)
}

function dokHref(path: string, id: string): string {
  return `${path}?dok=${encodeURIComponent(id)}`
}

export function buildInbox(src: InboxSources): InboxItem[] {
  const items: InboxItem[] = []

  for (const r of src.saleReturns) {
    if (r.stage !== 'diajukan') continue
    const actors: UserRole[] = ['keuangan', 'admin']
    if (!visibleTo(src.role, actors)) continue
    const qty = r.lines.reduce((s, l) => s + l.qty, 0)
    items.push({
      id: `sr:${r.id}`,
      kind: 'sale_return',
      title: r.id,
      subtitle: `Retur jual · ${r.orderId}`,
      statusLabel: 'Diajukan',
      href: dokHref('/app/penjualan/retur', r.id),
      createdAt: r.createdAt,
      actorRoles: actors,
      details: [
        `Order: ${r.orderId}`,
        `Alasan: ${r.reason || ','}`,
        `Baris: ${r.lines.length} · qty ${qty}`,
      ],
    })
  }

  for (const r of src.purchaseReturns) {
    if (r.stage !== 'diajukan') continue
    const actors: UserRole[] = ['keuangan', 'admin']
    if (!visibleTo(src.role, actors)) continue
    const qty = r.lines.reduce((s, l) => s + l.qty, 0)
    items.push({
      id: `pr:${r.id}`,
      kind: 'purchase_return',
      title: r.id,
      subtitle: `Retur beli · ${r.purchaseId}`,
      statusLabel: 'Diajukan',
      href: dokHref('/app/pembelian/retur', r.id),
      createdAt: r.createdAt,
      actorRoles: actors,
      details: [
        `Pembelian: ${r.purchaseId}`,
        r.lotId ? `Lot: ${r.lotId}` : '',
        `Alasan: ${r.reason || ','}`,
        `Baris: ${r.lines.length} · qty ${qty}`,
      ].filter(Boolean),
    })
  }

  for (const p of src.purchases) {
    if (p.stage !== 'diajukan' || p.voidedAt) continue
    const actors: UserRole[] = ['keuangan', 'admin']
    if (!visibleTo(src.role, actors)) continue
    const summary = summarize(p)
    items.push({
      id: `po:${p.id}`,
      kind: 'purchase_budget',
      title: p.id,
      subtitle: 'Approve anggaran pembelian',
      statusLabel: 'Menunggu approve',
      href: dokHref('/app/pembelian', p.id),
      createdAt: p.date,
      actorRoles: actors,
      details: [
        `Pemasok: ${p.supplierId}`,
        `Tanggal: ${p.date}`,
        `Estimasi: ${summary.estimatedValue.toLocaleString('id-ID')}`,
        p.vehicle ? `Kendaraan: ${p.vehicle}` : '',
        p.note ? `Catatan: ${p.note}` : '',
      ].filter(Boolean),
    })
  }

  for (const b of src.batches) {
    if (b.stage !== 'submitted') continue
    const actors: UserRole[] = ['admin']
    if (!visibleTo(src.role, actors)) continue
    items.push({
      id: `batch:${b.id}`,
      kind: 'batch',
      title: b.id,
      subtitle: `Batch giling · ${b.inputName}`,
      statusLabel: 'Menunggu approve',
      href: dokHref('/app/produksi', b.id),
      createdAt: b.submittedAt ?? b.date,
      actorRoles: actors,
      details: [
        `Input: ${b.inputName}`,
        `Qty input: ${b.inputQty}`,
        `Tanggal: ${b.date}`,
        b.note ? `Catatan: ${b.note}` : '',
      ].filter(Boolean),
    })
  }

  for (const run of src.payrollRuns) {
    let actors: UserRole[] = []
    let statusLabel = 'Menunggu approve'
    let href = dokHref('/app/keuangan/payroll', run.id)
    if (run.status === 'menunggu_hr') {
      actors = ['hr']
      statusLabel = 'Menunggu HR'
      href = dokHref('/hr/payroll/persetujuan', run.id)
    } else if (run.status === 'menunggu_admin') {
      actors = ['admin']
      statusLabel = 'Menunggu admin'
      href = dokHref('/hr/payroll/persetujuan', run.id)
    } else if (run.status === 'menunggu_keuangan') {
      actors = ['keuangan']
      statusLabel = 'Menunggu keuangan'
    } else if (run.status === 'siap_cair') {
      actors = ['keuangan']
      statusLabel = 'Siap cair'
    } else if (run.status === 'menunggu_approve') {
      actors = ['admin', 'keuangan', 'hr']
    } else {
      continue
    }
    if (!visibleTo(src.role, actors)) continue
    items.push({
      id: `pay:${run.id}`,
      kind: 'payroll',
      title: run.id,
      subtitle: `Payroll · ${run.period}`,
      statusLabel,
      href,
      createdAt: run.createdAt,
      actorRoles: actors,
      details: [
        `Periode: ${run.period}`,
        `Karyawan: ${run.lines.length}`,
        `Total bersih: ${runTotal(run).toLocaleString('id-ID')}`,
        run.note ? `Catatan: ${run.note}` : '',
      ].filter(Boolean),
    })
  }

  for (const req of src.unlockRequests) {
    if (req.status !== 'pending') continue
    const lock = src.periodLocks.find((l) => l.id === req.periodLockId)
    const needsRole =
      req.requiredRoles.includes(src.role as Exclude<UserRole, 'admin'>) &&
      !req.approvals.some((a) => a.role === src.role)
    const needsAdmin =
      src.role === 'admin' &&
      req.requiredRoles.every((role) =>
        req.approvals.some((a) => a.role === role),
      ) &&
      !req.adminApproval
    if (!needsRole && !needsAdmin && src.role !== 'admin') continue
    if (src.role === 'admin' && !needsAdmin && !needsRole) {
      // admin still sees pending unlocks in inbox
    }
    const actors: UserRole[] = [
      'admin',
      ...(req.requiredRoles as UserRole[]),
    ]
    const approved = req.requiredRoles
      .map((role) => {
        const stamp = req.approvals.find((a) => a.role === role)
        return stamp ? `${role}: ✓ ${stamp.by}` : `${role}: menunggu`
      })
      .join(' · ')
    items.push({
      id: `unlock:${req.id}`,
      kind: 'period_unlock',
      title: lock
        ? lock.kind === 'month' && lock.yearMonth
          ? `Unlock ${lock.yearMonth}`
          : `Unlock ${lock.startDate}–${lock.endDate}`
        : `Unlock ${req.id}`,
      subtitle: req.reason,
      statusLabel: 'Menunggu unlock',
      href: dokHref('/app/keuangan/periode', req.id),
      createdAt: req.createdAt,
      actorRoles: actors,
      details: [
        lock
          ? `Periode: ${lock.startDate} – ${lock.endDate}`
          : `Lock: ${req.periodLockId}`,
        `Alasan: ${req.reason}`,
        `Diminta oleh: ${req.createdBy}`,
        `Persetujuan role: ${approved || ','}`,
        req.adminApproval
          ? `Admin: ✓ ${req.adminApproval.by}`
          : 'Admin final: menunggu',
      ],
    })
  }

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
