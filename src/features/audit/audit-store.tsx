import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import {
  nextAuditId,
  type AuditAction,
  type AuditEntity,
  type AuditLog,
} from '@/features/audit/audit-data'
import { auditRepository } from '@/features/audit/audit-storage'
import { publishSync } from '@/features/sync/sync-bus'

type AppendInput = {
  action: AuditAction
  entity: AuditEntity
  entityId: string
  before?: unknown
  after?: unknown
  note?: string
}

type AuditStoreValue = {
  logs: AuditLog[]
  appendAudit: (input: AppendInput) => void
}

const AuditContext = createContext<AuditStoreValue | null>(null)

export function AuditProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>(
    () => auditRepository.load().logs,
  )

  useEffect(() => {
    auditRepository.save({
      version: 1,
      logs,
      updatedAt: new Date().toISOString(),
    })
  }, [logs])

  const appendAudit = useCallback(
    (input: AppendInput) => {
      setLogs((list) => {
        const entry: AuditLog = {
          id: nextAuditId(list),
          at: new Date().toISOString(),
          actor: user?.name ?? 'Sistem',
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          before: input.before,
          after: input.after,
          note: input.note,
        }
        const next = [entry, ...list].slice(0, 500)
        publishSync('audit', entry.id)
        return next
      })
    },
    [user?.name],
  )

  const value = useMemo(
    () => ({ logs, appendAudit }),
    [logs, appendAudit],
  )

  return (
    <AuditContext.Provider value={value}>{children}</AuditContext.Provider>
  )
}

export function useAuditStore(): AuditStoreValue {
  const ctx = useContext(AuditContext)
  if (!ctx) throw new Error('useAuditStore harus di dalam AuditProvider')
  return ctx
}
