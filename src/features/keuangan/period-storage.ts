import { createLocalRepository } from '@/lib/create-local-repository'
import {
  EMPTY_PERIOD_SNAPSHOT,
  type PeriodSnapshot,
} from '@/features/keuangan/period-data'

function seed(): PeriodSnapshot {
  return {
    ...EMPTY_PERIOD_SNAPSHOT,
    locks: [],
    unlockRequests: [],
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is PeriodSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PeriodSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.locks) &&
    Array.isArray(v.unlockRequests)
  )
}

export const periodRepository = createLocalRepository({
  key: 'egabah.period.v1',
  seed,
  isValid,
})
