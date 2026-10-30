import { createLocalRepository } from '@/lib/create-local-repository'
import {
  INITIAL_PURCHASES,
  migratePurchaseStage,
  type Purchase,
} from '@/features/pembelian/pembelian-data'

export type PembelianSnapshot = {
  version: 1
  purchases: Purchase[]
  updatedAt: string
}

function normalize(snapshot: PembelianSnapshot): PembelianSnapshot {
  return {
    ...snapshot,
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
    updatedAt: new Date().toISOString(),
  })
}

function isValid(value: unknown): value is PembelianSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PembelianSnapshot
  return v.version === 1 && Array.isArray(v.purchases)
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
