import { getSupabase, isSupabaseConfigured } from '@/lib/supabase-client'
import { mapSupabaseError } from '@/features/master/master-cloud'

export type ModuleKey =
  | 'pembelian'
  | 'penjualan'
  | 'produksi'
  | 'keuangan'
  | 'period'
  | 'bank'
  | 'tax'
  | 'gl'
  | 'payroll'
  | 'audit'

const cache = new Map<ModuleKey, unknown>()
const saveTimers = new Map<ModuleKey, number>()

export { mapSupabaseError }

export function isCloudModulesEnabled(): boolean {
  return isSupabaseConfigured()
}

export function getCachedModuleSnapshot<T>(key: ModuleKey): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCachedModuleSnapshot<T>(key: ModuleKey, value: T): void {
  cache.set(key, value)
}

export async function loadModuleSnapshot<T>(
  key: ModuleKey,
): Promise<T | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('app_module_snapshots')
    .select('payload')
    .eq('module_key', key)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const payload = data.payload as T
  cache.set(key, payload)
  return payload
}

export async function saveModuleSnapshot<T extends object>(
  key: ModuleKey,
  payload: T,
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  cache.set(key, payload)
  const { error } = await sb.from('app_module_snapshots').upsert({
    module_key: key,
    payload,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

/** Debounced cloud save; no-op when cloud disabled. */
export function scheduleModuleSave<T extends object>(
  key: ModuleKey,
  payload: T,
  onError?: (message: string) => void,
): void {
  if (!isCloudModulesEnabled()) return
  cache.set(key, payload)
  const prev = saveTimers.get(key)
  if (prev) window.clearTimeout(prev)
  const handle = window.setTimeout(() => {
    void saveModuleSnapshot(key, payload).catch((e) => {
      onError?.(mapSupabaseError(e))
    })
  }, 300)
  saveTimers.set(key, handle)
}

export async function hydrateAllModuleSnapshots(
  keys: ModuleKey[],
): Promise<void> {
  if (!isCloudModulesEnabled()) return
  await Promise.all(
    keys.map(async (key) => {
      try {
        await loadModuleSnapshot(key)
      } catch {
        // leave cache empty → repository falls back to local seed once
      }
    }),
  )
}
