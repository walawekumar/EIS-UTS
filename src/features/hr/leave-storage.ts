import type { LeaveRequest } from '@/features/hr/leave-data'
import { createLocalRepository } from '@/lib/create-local-repository'

export type LeaveSnapshot = {
  version: 1
  requests: LeaveRequest[]
}

function isValid(value: unknown): value is LeaveSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as LeaveSnapshot
  return v.version === 1 && Array.isArray(v.requests)
}

export const leaveRepository = createLocalRepository<LeaveSnapshot>({
  key: 'egabah.leave.v1',
  seed: () => ({ version: 1, requests: [] }),
  isValid,
})
