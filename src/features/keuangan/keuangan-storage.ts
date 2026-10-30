import { createLocalRepository } from '@/lib/create-local-repository'
import {
  CASH_ENTRIES,
  EXPENSES,
  PAYABLES,
  RECEIVABLES,
  type CashEntry,
  type ExpenseRow,
  type PayableRow,
  type ReceivableRow,
} from '@/features/keuangan/keuangan-data'

export type KeuanganSnapshot = {
  version: 1
  cashEntries: CashEntry[]
  payables: PayableRow[]
  receivables: ReceivableRow[]
  expenses: ExpenseRow[]
  updatedAt: string
}

function seed(): KeuanganSnapshot {
  return {
    version: 1,
    cashEntries: structuredClone(CASH_ENTRIES),
    payables: structuredClone(PAYABLES),
    receivables: structuredClone(RECEIVABLES),
    expenses: structuredClone(EXPENSES),
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is KeuanganSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as KeuanganSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.cashEntries) &&
    Array.isArray(v.payables) &&
    Array.isArray(v.receivables) &&
    Array.isArray(v.expenses)
  )
}

export const keuanganRepository = createLocalRepository({
  key: 'egabah.keuangan.v1',
  seed,
  isValid,
})
