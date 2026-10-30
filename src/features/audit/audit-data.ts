export type AuditAction =
  | 'create'
  | 'update'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'start'
  | 'post'
  | 'return'
  | 'void'
  | 'delete'

export type AuditEntity =
  | 'batch'
  | 'purchase'
  | 'sale'
  | 'stock_correction'
  | 'expense'
  | 'partner'
  | 'product'
  | 'user'

export type AuditLog = {
  id: string
  at: string
  actor: string
  action: AuditAction
  entity: AuditEntity
  entityId: string
  before?: unknown
  after?: unknown
  note?: string
}

export function nextAuditId(list: AuditLog[]): string {
  const max = list.reduce((m, row) => {
    const n = Number(String(row.id).replace(/\D/g, ''))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `AUD-${String(max + 1).padStart(4, '0')}`
}
