import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuditStore } from '@/features/audit/audit-store'
import { useAuth } from '@/features/auth/AuthContext'
import { type AccountMapKey } from '@/features/keuangan/gl-data'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import {
  nextPayrollId,
  runTotal,
  type PayrollLine,
  type PayrollRun,
} from '@/features/payroll/payroll-data'
import { payrollRepository } from '@/features/payroll/payroll-storage'
import {
  clearApprovals,
  hasApproval,
  upsertApproval,
  type ApprovalStamp,
} from '@/features/workflow/approvals'
import { hasProof, type ProofAttachment } from '@/features/workflow/proof'
type PayrollStoreValue = {
  runs: PayrollRun[]
  createRun: (period: string, lines: PayrollLine[], note: string) => string
  updateDraft: (
    id: string,
    patch: { lines?: PayrollLine[]; note?: string; mutationNote?: string },
  ) => void
  submitForApproval: (id: string) => string | undefined
  approveAsAdmin: (id: string) => string | undefined
  approveAsKeuangan: (id: string) => string | undefined
  postRun: (id: string, proof: ProofAttachment | string) => string | undefined
  voidRun: (id: string) => void
  deleteRun: (id: string) => void
}

const PayrollContext = createContext<PayrollStoreValue | null>(null)

function refreshReady(run: PayrollRun): PayrollRun {
  const ready =
    hasApproval(run.approvals, 'admin') && hasApproval(run.approvals, 'keuangan')
  if (run.status === 'menunggu_approve' && ready) {
    return { ...run, status: 'siap_cair' }
  }
  return run
}

function stamp(role: 'admin' | 'keuangan', name: string): ApprovalStamp {
  return {
    role,
    by: name,
    at: new Date().toISOString(),
  }
}

function todayGlDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function postPayrollJournal(
  postJournalEntry: ReturnType<typeof useFinanceStore>['postJournalEntry'],
  mapAccount: ReturnType<typeof useFinanceStore>['mapAccount'],
  input: {
    date: string
    memo: string
    sourceKey: string
    amount: number
    debitKey: AccountMapKey
    creditKey: AccountMapKey
  },
): void {
  const { amount, date, memo, sourceKey, debitKey, creditKey } = input
  if (!Number.isFinite(amount) || amount <= 0) return
  postJournalEntry({
    date,
    memo,
    sourceKey,
    sourceType: 'auto',
    manual: false,
    lines: [
      {
        accountId: mapAccount(debitKey),
        debit: amount,
        credit: 0,
        memo,
      },
      {
        accountId: mapAccount(creditKey),
        debit: 0,
        credit: amount,
        memo,
      },
    ],
  })
}

export function PayrollProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { appendAudit } = useAuditStore()
  const { addCashEntry, postJournalEntry, reverseJournalEntry, mapAccount } =
    useFinanceStore()
  const [runs, setRuns] = useState<PayrollRun[]>(
    () => payrollRepository.load().runs,
  )

  useEffect(() => {
    payrollRepository.save({
      version: 1,
      runs,
      updatedAt: new Date().toISOString(),
    })
  }, [runs])

  const createRun = useCallback(
    (period: string, lines: PayrollLine[], note: string) => {
      const id = nextPayrollId(runs, period)
      const row: PayrollRun = {
        id,
        period,
        status: 'draft',
        createdAt: new Date().toISOString(),
        actor: user?.name ?? 'Sistem',
        lines,
        note,
        approvals: [],
      }
      setRuns((list) => [row, ...list])
      appendAudit({
        action: 'create',
        entity: 'expense',
        entityId: id,
        after: row,
        note: `Payroll ${period}`,
      })
      return id
    },
    [runs, user?.name, appendAudit],
  )

  const updateDraft = useCallback(
    (
      id: string,
      patch: { lines?: PayrollLine[]; note?: string; mutationNote?: string },
    ) => {
      setRuns((list) =>
        list.map((r) => {
          if (r.id !== id) return r
          if (r.status === 'posted' || r.status === 'void') return r

          const linesChanged =
            patch.lines !== undefined &&
            JSON.stringify(patch.lines) !== JSON.stringify(r.lines)

          if (
            linesChanged &&
            (r.status === 'menunggu_approve' || r.status === 'siap_cair')
          ) {
            return {
              ...r,
              lines: patch.lines!,
              approvals: clearApprovals(),
              status: 'draft',
              ...(patch.note !== undefined ? { note: patch.note } : null),
              ...(patch.mutationNote !== undefined
                ? { mutationNote: patch.mutationNote }
                : null),
            }
          }

          if (r.status === 'draft') {
            return {
              ...r,
              ...(patch.lines ? { lines: patch.lines } : null),
              ...(patch.note !== undefined ? { note: patch.note } : null),
              ...(patch.mutationNote !== undefined
                ? { mutationNote: patch.mutationNote }
                : null),
            }
          }

          return {
            ...r,
            ...(patch.note !== undefined ? { note: patch.note } : null),
            ...(patch.mutationNote !== undefined
              ? { mutationNote: patch.mutationNote }
              : null),
          }
        }),
      )
    },
    [],
  )

  const submitForApproval = useCallback(
    (id: string): string | undefined => {
      const current = runs.find((r) => r.id === id)
      if (!current || current.status !== 'draft') {
        return 'Hanya draft yang bisa diajukan'
      }
      setRuns((list) =>
        list.map((r) =>
          r.id === id
            ? { ...r, status: 'menunggu_approve', approvals: clearApprovals() }
            : r,
        ),
      )
      appendAudit({
        action: 'update',
        entity: 'expense',
        entityId: id,
        note: 'Payroll diajukan untuk approve',
      })
      return undefined
    },
    [runs, appendAudit],
  )

  const approveAsAdmin = useCallback(
    (id: string): string | undefined => {
      if (user?.role !== 'admin') return 'Hanya admin yang bisa approve sebagai admin'
      const current = runs.find((r) => r.id === id)
      if (!current || current.status !== 'menunggu_approve') {
        return 'Payroll tidak menunggu approve'
      }
      if (hasApproval(current.approvals, 'admin')) {
        return 'Approve admin sudah tercatat'
      }
      const next = refreshReady({
        ...current,
        approvals: upsertApproval(
          current.approvals,
          stamp('admin', user.name),
        ),
      })
      setRuns((list) => list.map((r) => (r.id === id ? next : r)))
      appendAudit({
        action: 'approve',
        entity: 'expense',
        entityId: id,
        note: 'Approve payroll (admin)',
      })
      return undefined
    },
    [runs, user, appendAudit],
  )

  const approveAsKeuangan = useCallback(
    (id: string): string | undefined => {
      if (user?.role !== 'keuangan') {
        return 'Hanya keuangan yang bisa approve sebagai keuangan'
      }
      const current = runs.find((r) => r.id === id)
      if (!current || current.status !== 'menunggu_approve') {
        return 'Payroll tidak menunggu approve'
      }
      if (hasApproval(current.approvals, 'keuangan')) {
        return 'Approve keuangan sudah tercatat'
      }
      const next = refreshReady({
        ...current,
        approvals: upsertApproval(
          current.approvals,
          stamp('keuangan', user.name),
        ),
      })
      setRuns((list) => list.map((r) => (r.id === id ? next : r)))
      appendAudit({
        action: 'approve',
        entity: 'expense',
        entityId: id,
        note: 'Approve payroll (keuangan)',
      })
      return undefined
    },
    [runs, user, appendAudit],
  )

  const postRun = useCallback(
    (id: string, proof: ProofAttachment | string): string | undefined => {
      const role = user?.role
      if (role !== 'keuangan' && role !== 'admin') {
        return 'Hanya keuangan atau admin yang bisa mencairkan payroll'
      }
      const current = runs.find((r) => r.id === id)
      if (!current || current.status !== 'siap_cair') {
        return 'Payroll harus siap cair sebelum dicairkan'
      }
      if (!hasProof(proof)) {
        return 'Lampirkan bukti transfer sebelum cair'
      }
      const total = runTotal(current)
      addCashEntry({
        direction: 'out',
        category: 'Payroll',
        description: `Gaji ${current.period} · ${current.id}${
          current.mutationNote ? ` · ${current.mutationNote}` : ''
        }`,
        amount: total,
      })
      setRuns((list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'posted',
                postedAt: new Date().toISOString(),
                transferProof: proof,
              }
            : r,
        ),
      )
      postPayrollJournal(postJournalEntry, mapAccount, {
        date: todayGlDate(),
        memo: `Payroll ${current.period} · ${current.id}`,
        sourceKey: `payrun:${id}:post`,
        amount: total,
        debitKey: 'payroll',
        creditKey: 'cash',
      })
      appendAudit({
        action: 'post',
        entity: 'expense',
        entityId: id,
        note: `Cair payroll ${total}`,
      })
      return undefined
    },
    [runs, user?.role, addCashEntry, postJournalEntry, mapAccount, appendAudit],
  )

  const voidRun = useCallback(
    (id: string) => {
      const current = runs.find((r) => r.id === id)
      if (!current || current.status === 'void') return
      if (current.status === 'posted') {
        addCashEntry({
          direction: 'in',
          category: 'Payroll',
          description: `Void gaji ${current.period} · ${current.id}`,
          amount: runTotal(current),
        })
        reverseJournalEntry({ sourceKey: `payrun:${id}:post` })
      }
      setRuns((list) =>
        list.map((r) =>
          r.id === id
            ? { ...r, status: 'void', voidedAt: new Date().toISOString() }
            : r,
        ),
      )
      appendAudit({
        action: 'void',
        entity: 'expense',
        entityId: id,
        note: 'Void payroll',
      })
    },
    [runs, addCashEntry, reverseJournalEntry, appendAudit],
  )

  const deleteRun = useCallback(
    (id: string) => {
      setRuns((list) => {
        const target = list.find((r) => r.id === id)
        if (!target || target.status !== 'draft') return list
        appendAudit({
          action: 'delete',
          entity: 'expense',
          entityId: id,
          before: target,
        })
        return list.filter((r) => r.id !== id)
      })
    },
    [appendAudit],
  )

  const value = useMemo(
    () => ({
      runs,
      createRun,
      updateDraft,
      submitForApproval,
      approveAsAdmin,
      approveAsKeuangan,
      postRun,
      voidRun,
      deleteRun,
    }),
    [
      runs,
      createRun,
      updateDraft,
      submitForApproval,
      approveAsAdmin,
      approveAsKeuangan,
      postRun,
      voidRun,
      deleteRun,
    ],
  )

  return (
    <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>
  )
}

export function usePayrollStore(): PayrollStoreValue {
  const ctx = useContext(PayrollContext)
  if (!ctx) throw new Error('usePayrollStore harus di dalam PayrollProvider')
  return ctx
}
