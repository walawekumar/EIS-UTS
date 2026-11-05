import type { UserRole } from '@/types/auth'

export type InboxKind =
  | 'sale_return'
  | 'purchase_return'
  | 'purchase_budget'
  | 'batch'
  | 'payroll'
  | 'period_unlock'

export type InboxItem = {
  id: string
  kind: InboxKind
  title: string
  subtitle: string
  statusLabel: string
  href: string
  createdAt: string
  /** Roles that can act on this item */
  actorRoles: UserRole[]
  /** Extra facts shown in inbox detail panel */
  details: string[]
}
