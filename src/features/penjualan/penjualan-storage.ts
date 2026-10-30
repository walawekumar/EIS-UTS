import { createLocalRepository } from '@/lib/create-local-repository'
import {
  INITIAL_ORDERS,
  type SaleOrder,
  type SaleReturn,
} from '@/features/penjualan/penjualan-data'
import { migrateReturnStage } from '@/features/workflow/doc-stages'

export type PenjualanSnapshot = {
  version: 1
  orders: SaleOrder[]
  returns: SaleReturn[]
  updatedAt: string
}

function normalize(snapshot: PenjualanSnapshot): PenjualanSnapshot {
  return {
    ...snapshot,
    returns: (snapshot.returns ?? []).map((r) => ({
      ...r,
      stage: migrateReturnStage(String(r.stage)),
    })),
  }
}

function seed(): PenjualanSnapshot {
  return normalize({
    version: 1,
    orders: structuredClone(INITIAL_ORDERS),
    returns: [],
    updatedAt: new Date().toISOString(),
  })
}

function isValid(value: unknown): value is PenjualanSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PenjualanSnapshot
  return v.version === 1 && Array.isArray(v.orders)
}

const inner = createLocalRepository({
  key: 'egabah.penjualan.v1',
  seed,
  isValid,
})

export const penjualanRepository = {
  load(): PenjualanSnapshot {
    return normalize(inner.load())
  },
  save(data: PenjualanSnapshot) {
    inner.save(normalize(data))
  },
  clear() {
    inner.clear()
  },
}
