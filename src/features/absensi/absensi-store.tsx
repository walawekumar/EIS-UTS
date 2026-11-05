import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  loadAbsensiCloud,
  mapSupabaseError,
  saveAbsensiCloudForUser,
  upsertAbsensiCloudRows,
} from '@/features/absensi/absensi-cloud'
import {
  hasGeo,
  readBrowserGeo,
  todayIsoDate,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/features/absensi/absensi-data'
import { absensiRepository } from '@/features/absensi/absensi-storage'
import { useAuditStore } from '@/features/audit/audit-store'
import { useAuth } from '@/features/auth/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase-client'

type AbsensiStoreValue = {
  records: AttendanceRecord[]
  todayMine: AttendanceRecord | null
  ready: boolean
  persistError: string | null
  checkIn: () => Promise<string | undefined>
  checkOut: () => Promise<string | undefined>
  upsertAttendanceDays: (rows: AttendanceRecord[]) => Promise<string | undefined>
}

const AbsensiContext = createContext<AbsensiStoreValue | null>(null)

export function AbsensiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { appendAudit } = useAuditStore()
  const configured = isSupabaseConfigured()
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    configured ? [] : absensiRepository.load().records,
  )
  const [ready, setReady] = useState(!configured)
  const [cloudOk, setCloudOk] = useState(!configured)
  const [persistError, setPersistError] = useState<string | null>(null)
  const skipPersist = useRef(configured)
  const userIdRef = useRef(user?.id)

  useEffect(() => {
    userIdRef.current = user?.id
  }, [user?.id])

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadAbsensiCloud()
        if (cancelled) return
        skipPersist.current = true
        setRecords([...rows])
        setCloudOk(true)
        setPersistError(null)
        setReady(true)
      } catch (e) {
        if (cancelled) return
        skipPersist.current = true
        setRecords(absensiRepository.load().records)
        setCloudOk(false)
        setPersistError(
          `${mapSupabaseError(e)} Absensi memakai penyimpanan lokal sementara.`,
        )
        setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [configured])

  useEffect(() => {
    if (!ready) return
    if (skipPersist.current) {
      skipPersist.current = false
      return
    }
    const uid = userIdRef.current
    if (configured && cloudOk && uid) {
      const handle = window.setTimeout(() => {
        void saveAbsensiCloudForUser(uid, records)
          .then(() => setPersistError(null))
          .catch((e) => {
            absensiRepository.save({ version: 1, records })
            setPersistError(
              `${mapSupabaseError(e)} Disimpan lokal (cloud gagal).`,
            )
          })
      }, 300)
      return () => window.clearTimeout(handle)
    }
    absensiRepository.save({ version: 1, records })
  }, [configured, cloudOk, ready, records])

  const today = todayIsoDate()
  const todayMine = useMemo(() => {
    if (!user) return null
    return (
      records.find((r) => r.userId === user.id && r.date === today) ?? null
    )
  }, [records, user, today])

  const checkIn = useCallback(async (): Promise<string | undefined> => {
    if (!user) return 'Anda belum masuk.'
    if (!ready) return 'Absensi masih memuat…'
    if (todayMine?.checkIn) return 'Sudah check-in hari ini.'
    const geo = await readBrowserGeo()
    if (!hasGeo(geo)) {
      return 'Izinkan lokasi perangkat untuk check-in (geolocation wajib).'
    }
    const now = new Date()
    const late =
      now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 0)
    const row: AttendanceRecord = {
      id: `abs-${today}-${user.id}`,
      userId: user.id,
      userName: user.name,
      date: today,
      checkIn: now.toISOString(),
      checkInGeo: geo,
      status: late ? 'terlambat' : 'hadir',
    }
    setRecords((list) => [row, ...list.filter((r) => r.id !== row.id)])
    appendAudit({
      action: 'create',
      entity: 'attendance',
      entityId: row.id,
      after: row,
      note: late ? 'Check-in terlambat + geo' : 'Check-in + geo',
    })
    return undefined
  }, [user, todayMine, today, ready, appendAudit])

  const checkOut = useCallback(async (): Promise<string | undefined> => {
    if (!user) return 'Anda belum masuk.'
    if (!ready) return 'Absensi masih memuat…'
    if (!todayMine?.checkIn) return 'Check-in dulu sebelum check-out.'
    if (todayMine.checkOut) return 'Sudah check-out hari ini.'
    const geo = await readBrowserGeo()
    if (!hasGeo(geo)) {
      return 'Izinkan lokasi perangkat untuk check-out (geolocation wajib).'
    }
    const now = new Date().toISOString()
    const before = todayMine
    const after = { ...before, checkOut: now, checkOutGeo: geo }
    setRecords((list) =>
      list.map((r) => (r.id === todayMine.id ? after : r)),
    )
    appendAudit({
      action: 'update',
      entity: 'attendance',
      entityId: todayMine.id,
      before,
      after,
      note: 'Check-out + geo',
    })
    return undefined
  }, [user, todayMine, ready, appendAudit])

  const upsertAttendanceDays = useCallback(
    async (rows: AttendanceRecord[]): Promise<string | undefined> => {
      if (!rows.length) return undefined
      setRecords((list) => {
        const map = new Map(list.map((r) => [r.id, r]))
        for (const row of rows) map.set(row.id, row)
        return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
      })
      if (configured && cloudOk) {
        try {
          await upsertAbsensiCloudRows(rows)
          setPersistError(null)
        } catch (e) {
          absensiRepository.save({
            version: 1,
            records: (() => {
              const cur = absensiRepository.load().records
              const map = new Map(cur.map((r) => [r.id, r]))
              for (const row of rows) map.set(row.id, row)
              return [...map.values()]
            })(),
          })
          return mapSupabaseError(e)
        }
      }
      return undefined
    },
    [configured, cloudOk],
  )

  const value = useMemo(
    (): AbsensiStoreValue => ({
      records,
      todayMine,
      ready,
      persistError,
      checkIn,
      checkOut,
      upsertAttendanceDays,
    }),
    [
      records,
      todayMine,
      ready,
      persistError,
      checkIn,
      checkOut,
      upsertAttendanceDays,
    ],
  )

  return (
    <AbsensiContext.Provider value={value}>{children}</AbsensiContext.Provider>
  )
}

export function useAbsensiStore(): AbsensiStoreValue {
  const ctx = useContext(AbsensiContext)
  if (!ctx) {
    throw new Error('useAbsensiStore harus di dalam AbsensiProvider')
  }
  return ctx
}

export type { AttendanceStatus }
