import { createLocalRepository } from '@/lib/create-local-repository'
import { assembleAudit, projectAudit } from '@/lib/ops-relational/mappers/audit'
import { createRelationalBackedRepository } from '@/lib/relational-backed-repository'
import type { AuditLog } from '@/features/audit/audit-data'

export type AuditSnapshot = {
  version: 1
  logs: AuditLog[]
  updatedAt: string
}

function seed(): AuditSnapshot {
  return {
    version: 1,
    logs: [],
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is AuditSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as AuditSnapshot
  return v.version === 1 && Array.isArray(v.logs)
}

const inner = createLocalRepository({
  key: 'egabah.audit.v1',
  seed,
  isValid,
})

export const auditRepository = createRelationalBackedRepository({
  local: inner,
  tables: ['audit_logs'],
  assemble: assembleAudit,
  project: projectAudit,
})
