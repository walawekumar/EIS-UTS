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
  saveAbsensiCloud,
} from '@/features/absensi/absensi-cloud'
import {
  todayIsoDate,
  type AttendanceRecord,
} from '@/features/absensi/absensi-data'
import { absensiRepository } from '@/features/absensi/absensi-storage'
import { useAuth } from '@/features/auth/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase-client'

type AbsensiStoreValue = {
  records: AttendanceRecord[]
  todayMine: AttendanceRecord | null
  cloudReady: boolean
  persistError: string | null
  checkIn: () => string | undefined
  checkOut: () => string | undefined
}

const AbsensiContext = createContext<AbsensiStoreValue | null>(null)

export function AbsensiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const configured = isSupabaseConfigured()
  const boot = configured ? [] : absensiRepository.load().records
  const [records, setRecords] = useState<AttendanceRecord[]>(() => [...boot])
  const [cloudReady, setCloudReady] = useState(!configured)
  const [persistError, setPersistError] = useState<string | null>(null)
  const skipPersist = useRef(configured)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadAbsensiCloud()
        if (cancelled) return
        skipPersist.current = true
        setRecords([...rows])
        setPersistError(null)
        setCloudReady(true)
      } catch (e) {
        if (cancelled) return
        setPersistError(
          `${mapSupabaseError(e)} Absensi belum dimuat, penyimpanan cloud dinonaktifkan.`,
        )
        setCloudReady(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [configured])

  useEffect(() => {
    if (configured) {
      if (!cloudReady) return
      if (skipPersist.current) {
        skipPersist.current = false
        return
      }
      const handle = window.setTimeout(() => {
        void saveAbsensiCloud(records)
          .then(() => setPersistError(null))
          .catch((e) => setPersistError(mapSupabaseError(e)))
      }, 300)
      return () => window.clearTimeout(handle)
    }
    absensiRepository.save({ version: 1, records })
  }, [configured, cloudReady, records])

  const today = todayIsoDate()
  const todayMine = useMemo(() => {
    if (!user) return null
    return (
      records.find((r) => r.userId === user.id && r.date === today) ?? null
    )
  }, [records, user, today])

  const checkIn = useCallback((): string | undefined => {
    if (!user) return 'Anda belum masuk.'
    if (configured && !cloudReady) {
      return persistError ?? 'Absensi cloud belum siap.'
    }
    if (todayMine?.checkIn) return 'Sudah check-in hari ini.'
    const now = new Date()
    const late =
      now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 0)
    const row: AttendanceRecord = {
      id: `abs-${today}-${user.id}`,
      userId: user.id,
      userName: user.name,
      date: today,
      checkIn: now.toISOString(),
      status: late ? 'terlambat' : 'hadir',
    }
    setRecords((list) => [row, ...list.filter((r) => r.id !== row.id)])
    return undefined
  }, [user, todayMine, today, configured, cloudReady, persistError])

  const checkOut = useCallback((): string | undefined => {
    if (!user) return 'Anda belum masuk.'
    if (configured && !cloudReady) {
      return persistError ?? 'Absensi cloud belum siap.'
    }
    if (!todayMine?.checkIn) return 'Check-in dulu sebelum check-out.'
    if (todayMine.checkOut) return 'Sudah check-out hari ini.'
    const now = new Date().toISOString()
    setRecords((list) =>
      list.map((r) =>
        r.id === todayMine.id ? { ...r, checkOut: now } : r,
      ),
    )
    return undefined
  }, [user, todayMine, configured, cloudReady, persistError])

  const value = useMemo(
    (): AbsensiStoreValue => ({
      records,
      todayMine,
      cloudReady,
      persistError,
      checkIn,
      checkOut,
    }),
    [records, todayMine, cloudReady, persistError, checkIn, checkOut],
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
