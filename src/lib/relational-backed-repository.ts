import {
  getRelationalCache,
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

const bootstrappedGroups = new Set<string>()

function normCell(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

/** True when `next` is already what cloud returned (ignore extra DB columns). */
function sameProjection(
  prev: Record<string, unknown>[] | undefined,
  next: Record<string, unknown>[],
): boolean {
  if (!prev || prev.length !== next.length) return false
  const byId = new Map(prev.map((row) => [String(row.id ?? ''), row]))
  if (byId.size !== prev.length) return false
  for (const row of next) {
    const old = byId.get(String(row.id ?? ''))
    if (!old) return false
    for (const [key, value] of Object.entries(row)) {
      if (key === 'updated_at') continue
      if (normCell(old[key]) !== normCell(value)) return false
    }
  }
  return true
}

function projectedRowCount<TSnapshot extends object>(
  project: (snap: TSnapshot) => Partial<Record<OpsTableName, Record<string, unknown>[]>>,
  tables: OpsTableName[],
  snap: TSnapshot,
): number {
  const parts = project(snap)
  let n = 0
  for (const t of tables) n += (parts[t] ?? []).length
  return n
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
  const groupKey = tables.slice().sort().join(',')

  return {
    load() {
      if (isRelationalEnabled()) {
        for (const t of tables) {
          if (!wasRelationalHydrated(t)) return norm(local.load())
        }
        let base = norm(local.load())
        const assembled = assemble(base)
        if (!assembled) return base

        const cloudRows = projectedRowCount(project, tables, assembled)
        let localRows = projectedRowCount(project, tables, base)

        // Prior wipe may have saved empty snapshot locally. In DEV, re-seed once.
        if (cloudRows === 0 && localRows === 0 && import.meta.env.DEV) {
          local.clear()
          base = norm(local.load())
          localRows = projectedRowCount(project, tables, base)
        }

        // Empty cloud must not wipe non-empty local — bootstrap to cloud once.
        if (cloudRows === 0 && localRows > 0) {
          if (!bootstrappedGroups.has(groupKey)) {
            bootstrappedGroups.add(groupKey)
            const parts = project(base)
            for (const t of tables) {
              const rows = parts[t] ?? []
              setRelationalCache(t, rows)
              if (rows.length) {
                scheduleRelationalSave(t, rows, { quietForbidden: true })
              }
            }
          }
          return base
        }

        return norm(assembled)
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
        const prev = getRelationalCache(t)
        if (sameProjection(prev, rows)) continue
        setRelationalCache(t, rows)
        scheduleRelationalSave(t, rows)
      }
    },
    clear() {
      local.clear()
    },
  }
}
