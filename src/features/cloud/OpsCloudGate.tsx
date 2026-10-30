import { useEffect, useState, type ReactNode } from 'react'
import { ALL_RELATIONAL_HYDRATE_SPECS } from '@/lib/ops-relational/types'
import {
  flushPendingRelationalSaves,
  hydrateRelationalTables,
  isRelationalEnabled,
} from '@/lib/cloud-relational'
import {
  clearCloudPersistError,
  subscribeCloudPersistError,
} from '@/lib/cloud-persist-bus'

/**
 * Hydrate all relational ops tables before feature providers mount.
 * Without Supabase env, renders children immediately (localStorage mode).
 */
export function OpsCloudGate({ children }: { children: ReactNode }) {
  const enabled = isRelationalEnabled()
  const [ready, setReady] = useState(!enabled)
  const [persistError, setPersistError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void hydrateRelationalTables(ALL_RELATIONAL_HYDRATE_SPECS).finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    return subscribeCloudPersistError(setPersistError)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const onLeave = () => {
      void flushPendingRelationalSaves()
    }
    window.addEventListener('beforeunload', onLeave)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      window.removeEventListener('pagehide', onLeave)
      void flushPendingRelationalSaves()
    }
  }, [enabled])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-600">
        Memuat data cloud…
      </div>
    )
  }

  return (
    <>
      {persistError ? (
        <div
          className="flex items-start justify-between gap-3 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          <span>{persistError}</span>
          <button
            type="button"
            className="shrink-0 font-medium underline"
            onClick={() => clearCloudPersistError()}
          >
            Tutup
          </button>
        </div>
      ) : null}
      {children}
    </>
  )
}
