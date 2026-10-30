import {
  getCachedModuleSnapshot,
  isCloudModulesEnabled,
  scheduleModuleSave,
  setCachedModuleSnapshot,
  type ModuleKey,
} from '@/lib/cloud-snapshot'

type LocalRepo<T> = {
  load: () => T
  save: (data: T) => void
  clear: () => void
}

/**
 * Wraps a localStorage repository: when Supabase is configured and a cloud
 * cache entry exists, load/save go through the module snapshot cache.
 * Call hydrateAllModuleSnapshots before mounting feature providers.
 */
export function createCloudBackedRepository<T extends object>(options: {
  key: ModuleKey
  local: LocalRepo<T>
  normalize?: (data: T) => T
}): LocalRepo<T> {
  const { key, local, normalize } = options
  const norm = (data: T) => (normalize ? normalize(data) : data)

  return {
    load() {
      if (isCloudModulesEnabled()) {
        const cached = getCachedModuleSnapshot<T>(key)
        if (cached) return norm(cached)
        const seeded = norm(local.load())
        setCachedModuleSnapshot(key, seeded)
        scheduleModuleSave(key, seeded)
        return seeded
      }
      return norm(local.load())
    },
    save(data: T) {
      const next = norm(data)
      if (isCloudModulesEnabled()) {
        setCachedModuleSnapshot(key, next)
        scheduleModuleSave(key, next)
        return
      }
      local.save(next)
    },
    clear() {
      local.clear()
      if (isCloudModulesEnabled()) {
        setCachedModuleSnapshot(key, norm(local.load()))
      }
    },
  }
}
