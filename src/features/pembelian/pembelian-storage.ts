import { createLocalRepository } from '@/lib/create-local-repository'
import {
  INITIAL_PURCHASES,
  migratePurchaseStage,
  type LotQc,
  type Purchase,
  type PurchaseReturn,
} from '@/features/pembelian/pembelian-data'
import { migrateReturnStage } from '@/features/workflow/doc-stages'

export type PembelianSnapshot = {
  version: 1
  purchases: Purchase[]
  returns: PurchaseReturn[]
  lotQc: LotQc[]
  updatedAt: string
}

function normalize(snapshot: PembelianSnapshot): PembelianSnapshot {
  return {
    ...snapshot,
    returns: (snapshot.returns ?? []).map((r) => ({
      ...r,
      stage: migrateReturnStage(String(r.stage)),
    })),
    lotQc: snapshot.lotQc ?? [],
    purchases: snapshot.purchases.map((p) => ({
      ...p,
      stage: migratePurchaseStage(String(p.stage)),
    })),
  }
}

function seed(): PembelianSnapshot {
  return normalize({
    version: 1,
    purchases: structuredClone(INITIAL_PURCHASES),
    returns: [],
    lotQc: [],
    updatedAt: new Date().toISOString(),
  })
}

function isValid(value: unknown): value is PembelianSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PembelianSnapshot
  return v.version === 1 && Array.isArray(v.purchases)
  // returns/lotQc optional on disk → normalize fills []
}

const inner = createLocalRepository({
  key: 'egabah.pembelian.v1',
  seed,
  isValid,
})

export const pembelianRepository = {
  load(): PembelianSnapshot {
    return normalize(inner.load())
  },
  save(data: PembelianSnapshot) {
    inner.save(normalize(data))
  },
  clear() {
    inner.clear()
  },
}
