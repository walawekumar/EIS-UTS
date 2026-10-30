import type { InboxItem } from '@/features/inbox/inbox-data'
import type { UnlockRequest } from '@/features/keuangan/period-data'
import type { PeriodLock } from '@/features/keuangan/period-data'
import type { PayrollRun } from '@/features/payroll/payroll-data'
import type { Purchase, PurchaseReturn } from '@/features/pembelian/pembelian-data'
import type { SaleReturn } from '@/features/penjualan/penjualan-data'
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

export function buildInbox(src: InboxSources): InboxItem[] {
  const items: InboxItem[] = []

  for (const r of src.saleReturns) {
    if (r.stage !== 'diajukan') continue
    const actors: UserRole[] = ['keuangan', 'admin']
    if (!visibleTo(src.role, actors)) continue
    items.push({
      id: `sr:${r.id}`,
      kind: 'sale_return',
      title: r.id,
      subtitle: `Retur jual · ${r.orderId}`,
      statusLabel: 'Diajukan',
      href: '/app/penjualan/retur',
      createdAt: r.createdAt,
      actorRoles: actors,
    })
  }

  for (const r of src.purchaseReturns) {
    if (r.stage !== 'diajukan') continue
    const actors: UserRole[] = ['keuangan', 'admin']
    if (!visibleTo(src.role, actors)) continue
    items.push({
      id: `pr:${r.id}`,
      kind: 'purchase_return',
      title: r.id,
      subtitle: `Retur beli · ${r.purchaseId}`,
      statusLabel: 'Diajukan',
      href: '/app/pembelian/retur',
      createdAt: r.createdAt,
      actorRoles: actors,
    })
  }

  for (const p of src.purchases) {
    if (p.stage !== 'diajukan' || p.voidedAt) continue
    const actors: UserRole[] = ['keuangan', 'admin']
    if (!visibleTo(src.role, actors)) continue
    items.push({
      id: `po:${p.id}`,
      kind: 'purchase_budget',
      title: p.id,
      subtitle: 'Approve anggaran pembelian',
      statusLabel: 'Menunggu approve',
      href: '/app/pembelian',
      createdAt: p.date,
      actorRoles: actors,
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
      href: '/app/produksi',
      createdAt: b.submittedAt ?? b.date,
      actorRoles: actors,
    })
  }

  for (const run of src.payrollRuns) {
    if (run.status !== 'menunggu_approve') continue
    const actors: UserRole[] = ['admin', 'keuangan']
    if (!visibleTo(src.role, actors)) continue
    items.push({
      id: `pay:${run.id}`,
      kind: 'payroll',
      title: run.id,
      subtitle: `Payroll · ${run.period}`,
      statusLabel: 'Menunggu approve',
      href: '/app/keuangan/payroll',
      createdAt: run.createdAt,
      actorRoles: actors,
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
      href: '/app/keuangan/periode',
      createdAt: req.createdAt,
      actorRoles: actors,
    })
  }

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
