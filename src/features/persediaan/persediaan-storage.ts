/**
 * Persistence adapter untuk modul Persediaan.
 *
 * Sekarang: localStorage (MVP demo).
 * Nanti (Supabase / Firebase): ganti hanya implementasi
 * `persediaanRepository.load/save/clear` — store & UI tetap sama.
 *
 * Contoh arah Supabase:
 *   load  → from('stocks'|'movements'|'corrections').select()
 *   save  → upsert / realtime subscription (bukan dump penuh)
 */
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

export type PersediaanRepository = {
  load: () => PersediaanSnapshot
  save: (snapshot: PersediaanSnapshot) => void
  clear: () => void
}

const STORAGE_KEY = 'egabah.persediaan.v1'

function seedSnapshot(): PersediaanSnapshot {
  return {
    version: 1,
    stocks: structuredClone(STOCK_ROWS),
    movements: structuredClone(MOVEMENTS),
    corrections: structuredClone(CORRECTIONS),
    updatedAt: new Date().toISOString(),
  }
}

function isValidSnapshot(value: unknown): value is PersediaanSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PersediaanSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.stocks) &&
    Array.isArray(v.movements) &&
    Array.isArray(v.corrections)
  )
}

let bootCache: PersediaanSnapshot | null = null

function readStorage(): PersediaanSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedSnapshot()
    const parsed: unknown = JSON.parse(raw)
    if (!isValidSnapshot(parsed)) return seedSnapshot()
    return parsed
  } catch {
    return seedSnapshot()
  }
}

/** Local adapter — tukar body fungsi ini saat wiring Supabase/Firebase. */
export const persediaanRepository: PersediaanRepository = {
  load() {
    if (!bootCache) bootCache = readStorage()
    return bootCache
  },

  save(snapshot) {
    const next = { ...snapshot, updatedAt: new Date().toISOString() }
    bootCache = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // quota / private mode — diamkan di MVP
    }
  },

  clear() {
    bootCache = null
    localStorage.removeItem(STORAGE_KEY)
  },
}
