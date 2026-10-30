import { createLocalRepository } from '@/lib/create-local-repository'
import {
  assembleProduksi,
  projectProduksi,
} from '@/lib/ops-relational/mappers/produksi'
import { createRelationalBackedRepository } from '@/lib/relational-backed-repository'
import {
  SEED_BATCHES,
  type LotCost,
  type PackRun,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'

export type ProduksiSnapshot = {
  version: 1
  batches: ProductionBatch[]
  packRuns: PackRun[]
  lotCosts: LotCost[]
  updatedAt: string
}

function normalize(snapshot: ProduksiSnapshot): ProduksiSnapshot {
  return {
    ...snapshot,
    packRuns: snapshot.packRuns ?? [],
    lotCosts: snapshot.lotCosts ?? [],
  }
}

function seed(): ProduksiSnapshot {
  return normalize({
    version: 1,
    batches: structuredClone(SEED_BATCHES),
    packRuns: [],
    lotCosts: [],
    updatedAt: new Date().toISOString(),
  })
}

function isValid(value: unknown): value is ProduksiSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as ProduksiSnapshot
  return v.version === 1 && Array.isArray(v.batches)
}

const inner = createLocalRepository({
  key: 'egabah.produksi.v1',
  seed,
  isValid,
})

export const produksiRepository = createRelationalBackedRepository({
  local: inner,
  normalize,
  tables: [
    'production_batches',
    'batch_outputs',
    'pack_runs',
    'pack_run_lines',
    'lot_costs',
  ],
  assemble: assembleProduksi,
  project: projectProduksi,
})
