import { assertPeriodOpenAgainst } from '@/features/keuangan/period-helpers'
import { periodRepository } from '@/features/keuangan/period-storage'

export function assertPeriodOpen(isoDate: string): string | undefined {
  const snap = periodRepository.load()
  return assertPeriodOpenAgainst(snap.locks, isoDate)
}
