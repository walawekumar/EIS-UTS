import { getSupabase } from '@/lib/supabase-client'
import { mapSupabaseError } from '@/features/master/master-cloud'
import type { PersediaanSnapshot } from '@/features/persediaan/persediaan-storage'
import {
  correctionFromRow,
  correctionToRow,
  movementFromRow,
  movementToRow,
  stockFromRow,
  stockToRow,
  type StockBalanceRow,
  type StockCorrectionDbRow,
  type StockMovementDbRow,
} from '@/features/persediaan/persediaan-db-map'

export { mapSupabaseError }

export async function loadPersediaanCloud(): Promise<PersediaanSnapshot> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')

  const [stocksRes, movementsRes, correctionsRes] = await Promise.all([
    sb.from('stock_balances').select('*'),
    sb.from('stock_movements').select('*'),
    sb.from('stock_corrections').select('*'),
  ])

  if (stocksRes.error) throw stocksRes.error
  if (movementsRes.error) throw movementsRes.error
  if (correctionsRes.error) throw correctionsRes.error

  return {
    version: 1,
    stocks: (stocksRes.data as StockBalanceRow[]).map(stockFromRow),
    movements: (movementsRes.data as StockMovementDbRow[]).map(movementFromRow),
    corrections: (correctionsRes.data as StockCorrectionDbRow[]).map(
      correctionFromRow,
    ),
    updatedAt: new Date().toISOString(),
  }
}

async function syncCollection<T extends { id: string }>(
  table: 'stock_balances' | 'stock_movements' | 'stock_corrections',
  rows: T[],
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')

  if (rows.length) {
    const { error } = await sb.from(table).upsert(rows)
    if (error) throw error
  }

  const { data: existing, error: listErr } = await sb.from(table).select('id')
  if (listErr) throw listErr
  const existingIds = (existing ?? []).map((r) => r.id as string)
  if (rows.length === 0 && existingIds.length > 0) {
    throw new Error(
      `Menolak hapus semua baris ${table} — payload kosong sementara remote masih berisi data.`,
    )
  }
  const keep = new Set(rows.map((r) => r.id))
  const drop = existingIds.filter((id) => !keep.has(id))
  if (drop.length) {
    const { error } = await sb.from(table).delete().in('id', drop)
    if (error) throw error
  }
}

export async function savePersediaanCloud(
  snap: PersediaanSnapshot,
): Promise<void> {
  await syncCollection('stock_balances', snap.stocks.map(stockToRow))
  await syncCollection('stock_movements', snap.movements.map(movementToRow))
  await syncCollection(
    'stock_corrections',
    snap.corrections.map(correctionToRow),
  )
}
