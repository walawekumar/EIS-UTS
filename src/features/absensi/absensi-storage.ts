import type { AttendanceRecord } from '@/features/absensi/absensi-data'
import { createLocalRepository } from '@/lib/create-local-repository'

export type AbsensiSnapshot = {
  version: 1
  records: AttendanceRecord[]
}

function isSnapshot(value: unknown): value is AbsensiSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as AbsensiSnapshot
  return v.version === 1 && Array.isArray(v.records)
}

export const absensiRepository = createLocalRepository<AbsensiSnapshot>({
  key: 'egabah.absensi.v1',
  seed: () => ({ version: 1, records: [] }),
  isValid: isSnapshot,
})
