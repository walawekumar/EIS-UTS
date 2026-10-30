import type {
  PeriodKind,
  PeriodLock,
  PeriodSnapshot,
  UnlockHistoryEntry,
  UnlockImpactRole,
  UnlockRequest,
  UnlockRequestStatus,
} from '@/features/keuangan/period-data'
import { getRelationalCache } from '@/lib/cloud-relational'
import {
  approvalsFromJson,
  approvalsToJson,
  optStr,
  reqBool,
  reqStr,
} from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

const IMPACT_ROLES: readonly UnlockImpactRole[] = [
  'pembelian',
  'produksi',
  'gudang',
  'penjualan',
  'keuangan',
]

function parseKind(raw: unknown): PeriodKind {
  if (raw === 'month' || raw === 'range') return raw
  return 'month'
}

function parseUnlockStatus(raw: unknown): UnlockRequestStatus {
  if (
    raw === 'pending' ||
    raw === 'approved' ||
    raw === 'rejected' ||
    raw === 'cancelled'
  ) {
    return raw
  }
  return 'pending'
}

function isImpactRole(raw: unknown): raw is UnlockImpactRole {
  return IMPACT_ROLES.some((role) => role === raw)
}

function unlockHistoryFromJson(raw: unknown): UnlockHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const list: UnlockHistoryEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const e = item as Record<string, unknown>
    const entry: UnlockHistoryEntry = {
      at: reqStr(e.at),
      by: reqStr(e.by),
      reason: reqStr(e.reason),
    }
    const requestId = optStr(e.requestId)
    if (requestId) entry.requestId = requestId
    list.push(entry)
  }
  return list
}

function unlockHistoryToJson(list: UnlockHistoryEntry[]): UnlockHistoryEntry[] | null {
  if (!list.length) return null
  return list.map((entry) => {
    const row: UnlockHistoryEntry = { at: entry.at, by: entry.by, reason: entry.reason }
    if (entry.requestId) row.requestId = entry.requestId
    return row
  })
}

function requiredRolesFromJson(raw: unknown): UnlockImpactRole[] {
  if (!Array.isArray(raw)) return []
  const list: UnlockImpactRole[] = []
  for (const item of raw) {
    if (isImpactRole(item)) list.push(item)
  }
  return list
}

function requiredRolesToJson(roles: UnlockImpactRole[]): UnlockImpactRole[] | null {
  return roles.length ? [...roles] : null
}

function adminApprovalFromJson(raw: unknown): UnlockRequest['adminApproval'] {
  return approvalsFromJson([raw])?.[0]
}

function adminApprovalToJson(
  stamp: UnlockRequest['adminApproval'],
): Record<string, unknown> | null {
  if (!stamp) return null
  const row: Record<string, unknown> = { role: stamp.role, by: stamp.by, at: stamp.at }
  if (stamp.note) row.note = stamp.note
  return row
}

function lockFromRow(row: Record<string, unknown>): PeriodLock {
  const lock: PeriodLock = {
    id: reqStr(row.id),
    kind: parseKind(row.kind),
    startDate: reqStr(row.start_date),
    endDate: reqStr(row.end_date),
    active: reqBool(row.active),
    lockedAt: reqStr(row.locked_at),
    lockedBy: reqStr(row.locked_by),
    unlockHistory: unlockHistoryFromJson(row.unlock_history),
  }
  const yearMonth = optStr(row.year_month)
  if (yearMonth) lock.yearMonth = yearMonth
  const pending = optStr(row.pending_unlock_request_id)
  if (pending) lock.pendingUnlockRequestId = pending
  return lock
}

function requestFromRow(row: Record<string, unknown>): UnlockRequest {
  const request: UnlockRequest = {
    id: reqStr(row.id),
    periodLockId: reqStr(row.period_lock_id),
    reason: reqStr(row.reason),
    status: parseUnlockStatus(row.status),
    requiredRoles: requiredRolesFromJson(row.required_roles),
    approvals: approvalsFromJson(row.approvals) ?? [],
    createdAt: reqStr(row.created_at_label),
    createdBy: reqStr(row.created_by),
  }
  const adminApproval = adminApprovalFromJson(row.admin_approval)
  if (adminApproval) request.adminApproval = adminApproval
  const rejectedBy = optStr(row.rejected_by)
  if (rejectedBy) request.rejectedBy = rejectedBy
  const rejectReason = optStr(row.reject_reason)
  if (rejectReason) request.rejectReason = rejectReason
  return request
}

function lockToRow(lock: PeriodLock): Record<string, unknown> {
  return {
    id: lock.id,
    kind: lock.kind,
    year_month: lock.yearMonth ?? null,
    start_date: lock.startDate,
    end_date: lock.endDate,
    active: lock.active,
    locked_at: lock.lockedAt,
    locked_by: lock.lockedBy,
    unlock_history: unlockHistoryToJson(lock.unlockHistory),
    pending_unlock_request_id: lock.pendingUnlockRequestId ?? null,
  }
}

function requestToRow(request: UnlockRequest): Record<string, unknown> {
  return {
    id: request.id,
    period_lock_id: request.periodLockId,
    reason: request.reason,
    status: request.status,
    required_roles: requiredRolesToJson(request.requiredRoles),
    approvals: approvalsToJson(request.approvals),
    admin_approval: adminApprovalToJson(request.adminApproval),
    rejected_by: request.rejectedBy ?? null,
    reject_reason: request.rejectReason ?? null,
    created_at_label: request.createdAt,
    created_by: request.createdBy,
  }
}

export function assemblePeriod(base: PeriodSnapshot): PeriodSnapshot | null {
  const locks = getRelationalCache('period_locks')
  const requests = getRelationalCache('period_unlock_requests')
  if (!locks || !requests) return null

  return {
    ...base,
    locks: locks.map(lockFromRow),
    unlockRequests: requests.map(requestFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectPeriod(
  snap: PeriodSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  return {
    period_locks: snap.locks.map(lockToRow),
    period_unlock_requests: snap.unlockRequests.map(requestToRow),
  }
}
