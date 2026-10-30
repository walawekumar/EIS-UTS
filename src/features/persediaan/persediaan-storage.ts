/**
 * Persistence adapter untuk modul Persediaan.
 * Sekarang: localStorage via createLocalRepository.
 * Nanti: ganti body load/save tanpa ubah store/UI.
 */
import { createLocalRepository } from '@/lib/create-local-repository'
import {
  CORRECTIONS,
  MOVEMENTS,
  STOCK_ROWS,
  type CorrectionRow,
  type MovementRow,
  type StockRow,
} from '@/features/persediaan/persediaan-data'

export type PersediaanSnapshot = {
  version: 1
  stocks: StockRow[]
  movements: MovementRow[]
  corrections: CorrectionRow[]
  updatedAt: string
}

function seed(): PersediaanSnapshot {
  return {
    version: 1,
    stocks: structuredClone(STOCK_ROWS),
    movements: structuredClone(MOVEMENTS),
    corrections: structuredClone(CORRECTIONS),
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is PersediaanSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PersediaanSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.stocks) &&
    Array.isArray(v.movements) &&
    Array.isArray(v.corrections)
  )
}

const base = createLocalRepository({
  key: 'egabah.persediaan.v1',
  seed,
  isValid,
})

export const persediaanRepository = {
  load: base.load,
  save(snapshot: PersediaanSnapshot) {
    base.save({ ...snapshot, updatedAt: new Date().toISOString() })
  },
  clear: base.clear,
}
