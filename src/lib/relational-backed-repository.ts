import {
  isRelationalEnabled,
  scheduleRelationalSave,
  setRelationalCache,
  wasRelationalHydrated,
} from '@/lib/cloud-relational'
import type { OpsTableName } from '@/lib/ops-relational/types'

type LocalRepo<TSnapshot extends object> = {
  load: () => TSnapshot
  save: (data: TSnapshot) => void
  clear: () => void
}

export type RelationalTableBind<TSnapshot extends object> = {
  table: OpsTableName
  /** True when this table must be hydrated before assemble. */
  required: boolean
  /** Project snapshot → rows for this table (may be empty array). */
  readRows: (snap: TSnapshot) => Record<string, unknown>[]
  /**
   * Fold cached rows into snapshot. Called only after all required
   * tables for this bind group are hydrated — implementer usually
   * passes one `assemble` bind that reads multiple caches.
   */
  writeRows?: (snap: TSnapshot, rows: Record<string, unknown>[]) => TSnapshot
}

/**
 * Prefer a single assemble function that reads all related caches.
 */
export function createRelationalBackedRepository<TSnapshot extends object>(options: {
  local: LocalRepo<TSnapshot>
  normalize?: (data: TSnapshot) => TSnapshot
  /** Tables written on save (headers + children). */
  tables: OpsTableName[]
  /** Build snapshot slice from relational caches; null = not ready. */
  assemble: (base: TSnapshot) => TSnapshot | null
  /** Split snapshot into per-table rows. */
  project: (snap: TSnapshot) => Partial<Record<OpsTableName, Record<string, unknown>[]>>
}): LocalRepo<TSnapshot> {
  const { local, normalize, tables, assemble, project } = options
  const norm = (data: TSnapshot) => (normalize ? normalize(data) : data)

  return {
    load() {
      if (isRelationalEnabled()) {
        for (const t of tables) {
          if (!wasRelationalHydrated(t)) return norm(local.load())
        }
        const assembled = assemble(local.load())
        if (assembled) return norm(assembled)
        return norm(local.load())
      }
      return norm(local.load())
    },
    save(data: TSnapshot) {
      const next = norm(data)
      if (!isRelationalEnabled()) {
        local.save(next)
        return
      }
      // One unhydrated sibling means load() returned local/seed. Writing any
      // table in the group would replace cloud rows with that snapshot.
      if (tables.some((t) => !wasRelationalHydrated(t))) {
        local.save(next)
        return
      }
      const parts = project(next)
      for (const t of tables) {
        const rows = parts[t] ?? []
        setRelationalCache(t, rows)
        scheduleRelationalSave(t, rows)
      }
    },
    clear() {
      local.clear()
    },
  }
}
