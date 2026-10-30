import type { ApprovalStamp } from '@/features/workflow/approvals'
import type { UserRole } from '@/types/auth'

export type PeriodKind = 'month' | 'range'

export type UnlockHistoryEntry = {
  at: string
  by: string
  reason: string
  requestId?: string
}

export type PeriodLock = {
  id: string
  kind: PeriodKind
  yearMonth?: string
  startDate: string
  endDate: string
  active: boolean
  lockedAt: string
  lockedBy: string
  unlockHistory: UnlockHistoryEntry[]
  pendingUnlockRequestId?: string
}

export type UnlockRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

/** Ops roles that can appear in requiredRoles — never includes admin */
export type UnlockImpactRole = Exclude<UserRole, 'admin'>

export type UnlockRequest = {
  id: string
  periodLockId: string
  reason: string
  status: UnlockRequestStatus
  requiredRoles: UnlockImpactRole[]
  approvals: ApprovalStamp[]
  adminApproval?: ApprovalStamp
  rejectedBy?: string
  rejectReason?: string
  createdAt: string
  createdBy: string
}

export type PeriodSnapshot = {
  version: 1
  locks: PeriodLock[]
  unlockRequests: UnlockRequest[]
  updatedAt: string
}

export const EMPTY_PERIOD_SNAPSHOT: PeriodSnapshot = {
  version: 1,
  locks: [],
  unlockRequests: [],
  updatedAt: new Date(0).toISOString(),
}
