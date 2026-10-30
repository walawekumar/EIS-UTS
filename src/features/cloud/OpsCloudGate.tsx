import { useEffect, useState, type ReactNode } from 'react'
import {
  hydrateAllModuleSnapshots,
  isCloudModulesEnabled,
  type ModuleKey,
} from '@/lib/cloud-snapshot'

const MODULE_KEYS: ModuleKey[] = [
  'pembelian',
  'penjualan',
  'produksi',
  'keuangan',
  'period',
  'bank',
  'tax',
  'gl',
  'payroll',
  'audit',
]

/**
 * Hydrate ops module JSONB snapshots before feature providers mount.
 * Without Supabase env, renders children immediately (localStorage mode).
 */
export function OpsCloudGate({ children }: { children: ReactNode }) {
  const enabled = isCloudModulesEnabled()
  const [ready, setReady] = useState(!enabled)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void hydrateAllModuleSnapshots(MODULE_KEYS).finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-600">
        Memuat data cloud…
      </div>
    )
  }

  return children
}
