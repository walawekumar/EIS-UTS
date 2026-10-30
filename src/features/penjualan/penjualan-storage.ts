import { createLocalRepository } from '@/lib/create-local-repository'
import {
  INITIAL_ORDERS,
  type SaleOrder,
} from '@/features/penjualan/penjualan-data'

export type PenjualanSnapshot = {
  version: 1
  orders: SaleOrder[]
  updatedAt: string
}

function seed(): PenjualanSnapshot {
  return {
    version: 1,
    orders: structuredClone(INITIAL_ORDERS),
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is PenjualanSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PenjualanSnapshot
  return v.version === 1 && Array.isArray(v.orders)
}

export const penjualanRepository = createLocalRepository({
  key: 'egabah.penjualan.v1',
  seed,
  isValid,
})
