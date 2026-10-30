import { createLocalRepository } from '@/lib/create-local-repository'
import { createCloudBackedRepository } from '@/lib/cloud-backed-repository'
import {
  EMPTY_BANK_SNAPSHOT,
  type BankSnapshot,
} from '@/features/keuangan/bank-data'

function seed(): BankSnapshot {
  return {
    ...EMPTY_BANK_SNAPSHOT,
    sessions: [],
    lines: [],
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is BankSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as BankSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.lines)
  )
}

const inner = createLocalRepository({
  key: 'egabah.bank.v1',
  seed,
  isValid,
})

export const bankRepository = createCloudBackedRepository({
  key: 'bank',
  local: inner,
})
