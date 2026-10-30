import type { AuditAction, AuditEntity, AuditLog } from '@/features/audit/audit-data'
import type { AuditSnapshot } from '@/features/audit/audit-storage'
import { getRelationalCache } from '@/lib/cloud-relational'
import { optStr, reqStr } from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

function parseAction(raw: unknown): AuditAction {
  switch (raw) {
    case 'create':
    case 'update':
    case 'submit':
    case 'approve':
    case 'reject':
    case 'start':
    case 'post':
    case 'return':
    case 'void':
    case 'delete':
      return raw
    default:
      return 'update'
  }
}

function parseEntity(raw: unknown): AuditEntity {
  switch (raw) {
    case 'batch':
    case 'purchase':
    case 'sale':
    case 'stock_correction':
    case 'expense':
    case 'partner':
    case 'product':
    case 'user':
      return raw
    default:
      return 'batch'
  }
}

function copyJson(raw: unknown): unknown {
  return structuredClone(raw)
}

function logFromRow(row: Record<string, unknown>): AuditLog {
  const log: AuditLog = {
    id: reqStr(row.id),
    at: reqStr(row.at),
    actor: reqStr(row.actor),
    action: parseAction(row.action),
    entity: parseEntity(row.entity),
    entityId: reqStr(row.entity_id),
  }
  if (row.before_doc != null) log.before = copyJson(row.before_doc)
  if (row.after_doc != null) log.after = copyJson(row.after_doc)
  const note = optStr(row.note)
  if (note) log.note = note
  return log
}

function logToRow(log: AuditLog): Record<string, unknown> {
  return {
    id: log.id,
    at: log.at,
    actor: log.actor,
    action: log.action,
    entity: log.entity,
    entity_id: log.entityId,
    before_doc: log.before === undefined ? null : copyJson(log.before),
    after_doc: log.after === undefined ? null : copyJson(log.after),
    note: log.note ? log.note : null,
  }
}

export function assembleAudit(base: AuditSnapshot): AuditSnapshot | null {
  const logs = getRelationalCache('audit_logs')
  if (!logs) return null

  return {
    ...base,
    logs: logs.map(logFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectAudit(
  snap: AuditSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  return {
    audit_logs: snap.logs.map(logToRow),
  }
}
