import { getSupabase, isSupabaseConfigured } from '@/lib/supabase-client'
import { mapSupabaseError } from '@/features/master/master-cloud'
import {
  clearCloudPersistError,
  setCloudPersistError,
} from '@/lib/cloud-persist-bus'
import type { OpsTableName } from '@/lib/ops-relational/types'

const cache = new Map<OpsTableName, Record<string, unknown>[]>()
const hydrateOk = new Map<OpsTableName, boolean>()
const saveTimers = new Map<OpsTableName, number>()
const pending = new Map<OpsTableName, Record<string, unknown>[]>()

export function isRelationalEnabled(): boolean {
  return isSupabaseConfigured()
}

export function getRelationalCache(
  table: OpsTableName,
): Record<string, unknown>[] | undefined {
  return cache.get(table)
}

export function setRelationalCache(
  table: OpsTableName,
  rows: Record<string, unknown>[],
): void {
  cache.set(table, rows)
}

export function wasRelationalHydrated(table: OpsTableName): boolean {
  return hydrateOk.get(table) === true
}

function hasRelationalHydrateFailure(): boolean {
  for (const ok of hydrateOk.values()) {
    if (ok === false) return true
  }
  return false
}

export async function loadRelationalTable(
  table: OpsTableName,
): Promise<Record<string, unknown>[]> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await sb.from(table).select('*')
  if (error) throw error
  const rows = (data ?? []) as Record<string, unknown>[]
  cache.set(table, rows)
  hydrateOk.set(table, true)
  return rows
}

/** Replace-all save: upsert rows, delete ids not in payload. */
export async function saveRelationalTable(
  table: OpsTableName,
  rows: Record<string, unknown>[],
  getId: (row: Record<string, unknown>) => string = (r) => String(r.id),
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const stamped = rows
    .map((r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }))
    .filter((r) => Boolean(getId(r)))
  if (stamped.length) {
    const { error } = await sb.from(table).upsert(stamped)
    if (error) throw error
  }
  const { data: existing, error: listErr } = await sb.from(table).select('id')
  if (listErr) throw listErr
  const existingIds = (existing ?? []).map((r) =>
    String((r as { id: string }).id),
  )
  // Refuse accidental full wipe (empty local projection vs non-empty remote).
  if (stamped.length === 0 && existingIds.length > 0) {
    throw new Error(
      `Menolak hapus semua baris ${table} — payload kosong sementara remote masih berisi data.`,
    )
  }
  const keep = new Set(stamped.map(getId))
  const drop = existingIds.filter((id) => !keep.has(id))
  if (drop.length) {
    const { error } = await sb.from(table).delete().in('id', drop)
    if (error) throw error
  }
  cache.set(table, stamped)
  hydrateOk.set(table, true)
}

export function scheduleRelationalSave(
  table: OpsTableName,
  rows: Record<string, unknown>[],
): void {
  if (!isRelationalEnabled()) return
  cache.set(table, rows)
  pending.set(table, rows)
  const prev = saveTimers.get(table)
  if (prev) window.clearTimeout(prev)
  const handle = window.setTimeout(() => {
    pending.delete(table)
    void saveRelationalTable(table, rows).catch((e) =>
      setCloudPersistError(mapSupabaseError(e)),
    )
  }, 300)
  saveTimers.set(table, handle)
}

export async function flushPendingRelationalSaves(): Promise<void> {
  if (!isRelationalEnabled()) return
  for (const t of saveTimers.values()) window.clearTimeout(t)
  saveTimers.clear()
  const entries = [...pending.entries()]
  pending.clear()
  const outcomes = await Promise.all(
    entries.map(async ([table, rows]) => {
      try {
        await saveRelationalTable(table, rows)
        return true
      } catch (e) {
        setCloudPersistError(mapSupabaseError(e))
        return false
      }
    }),
  )
  if (outcomes.every((ok) => ok) && !hasRelationalHydrateFailure()) {
    clearCloudPersistError()
  }
}

export async function hydrateRelationalTables(
  specs: { table: OpsTableName }[],
): Promise<{ failed: string[] }> {
  if (!isRelationalEnabled()) return { failed: [] }
  const failed: string[] = []
  await Promise.all(
    specs.map(async ({ table }) => {
      try {
        await loadRelationalTable(table)
      } catch {
        hydrateOk.set(table, false)
        failed.push(table)
      }
    }),
  )
  if (failed.length) {
    setCloudPersistError(
      `Gagal memuat tabel: ${failed.join(', ')}. Aplikasi menunggu cloud siap.`,
    )
  } else {
    clearCloudPersistError()
  }
  return { failed }
}
