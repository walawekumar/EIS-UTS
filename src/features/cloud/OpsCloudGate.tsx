import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
import { hydrateAppSettings } from '@/features/settings/settings-cloud'

/**
 * Hydrate relational ops tables before feature providers mount.
 * Mounted only under AuthenticatedProviders (after login).
 */
export function OpsCloudGate({ children }: { children: ReactNode }) {
  const enabled = isRelationalEnabled()
  const [ready, setReady] = useState(!enabled)
  const [loading, setLoading] = useState(enabled)
  const [hydrateError, setHydrateError] = useState<string | null>(null)
  const [persistError, setPersistError] = useState<string | null>(null)

  const runHydrate = useCallback(async () => {
    setLoading(true)
    setHydrateError(null)
    const { failed } = await hydrateRelationalTables(ALL_RELATIONAL_HYDRATE_SPECS)
    if (failed.length) {
      setReady(false)
      setHydrateError(
        `Gagal memuat tabel cloud: ${failed.join(', ')}. Periksa koneksi / migrasi, lalu coba lagi.`,
      )
    } else {
      try {
        await hydrateAppSettings()
      } catch {
        // Pengaturan tetap bisa dibaca dari cache lokal.
      }
      setReady(true)
      setHydrateError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    void runHydrate()
  }, [enabled, runHydrate])

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

  if (enabled && (loading || !ready)) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-sm text-stone-600">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span
              className="size-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800"
              aria-hidden
            />
            <p>Memuat data cloud…</p>
          </div>
        ) : (
          <>
            <p className="max-w-md text-center text-amber-950" role="alert">
              {hydrateError ?? 'Data cloud belum siap.'}
            </p>
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => void runHydrate()}
            >
              Coba lagi
            </button>
          </>
        )}
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
