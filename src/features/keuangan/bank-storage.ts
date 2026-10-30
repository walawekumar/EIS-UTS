import { createLocalRepository } from '@/lib/create-local-repository'
import { assembleBank, projectBank } from '@/lib/ops-relational/mappers/bank'
import { createRelationalBackedRepository } from '@/lib/relational-backed-repository'
import { EMPTY_BANK_SNAPSHOT, type BankSnapshot } from '@/features/keuangan/bank-data'

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

export const bankRepository = createRelationalBackedRepository({
  local: inner,
  tables: ['bank_sessions', 'bank_lines'],
  assemble: assembleBank,
  project: projectBank,
})
