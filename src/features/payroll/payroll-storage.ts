import { createLocalRepository } from '@/lib/create-local-repository'
import {
  SEED_PAYROLL,
  normalizePayrollRun,
  type PayrollRun,
} from '@/features/payroll/payroll-data'

export type PayrollSnapshot = {
  version: 1
  runs: PayrollRun[]
  updatedAt: string
}

function normalize(snapshot: PayrollSnapshot): PayrollSnapshot {
  return {
    ...snapshot,
    runs: snapshot.runs.map((r) => normalizePayrollRun(r)),
  }
}

function seed(): PayrollSnapshot {
  return normalize({
    version: 1,
    runs: structuredClone(SEED_PAYROLL),
    updatedAt: new Date().toISOString(),
  })
}

function isValid(value: unknown): value is PayrollSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PayrollSnapshot
  return v.version === 1 && Array.isArray(v.runs)
}

const inner = createLocalRepository({
  key: 'egabah.payroll.v1',
  seed,
  isValid,
})

export const payrollRepository = {
  load(): PayrollSnapshot {
    return normalize(inner.load())
  },
  save(data: PayrollSnapshot) {
    inner.save(normalize(data))
  },
  clear() {
    inner.clear()
  },
}
