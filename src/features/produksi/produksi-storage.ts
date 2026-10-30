import { createLocalRepository } from '@/lib/create-local-repository'
import {
  SEED_BATCHES,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'

export type ProduksiSnapshot = {
  version: 1
  batches: ProductionBatch[]
  updatedAt: string
}

function seed(): ProduksiSnapshot {
  return {
    version: 1,
    batches: structuredClone(SEED_BATCHES),
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is ProduksiSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as ProduksiSnapshot
  return v.version === 1 && Array.isArray(v.batches)
}

export const produksiRepository = createLocalRepository({
  key: 'egabah.produksi.v1',
  seed,
  isValid,
})
