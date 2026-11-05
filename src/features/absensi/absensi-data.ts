export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpha'

export type GeoPoint = {
  lat: number
  lng: number
  accuracy?: number
}

export type AttendanceRecord = {
  id: string
  userId: string
  userName: string
  date: string
  checkIn?: string
  checkOut?: string
  checkInGeo?: GeoPoint
  checkOutGeo?: GeoPoint
  status: AttendanceStatus
  note?: string
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  alpha: 'Alpha',
}

export function todayIsoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatClock(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return todayIsoDate(d)
}

/** 30 hari inklusif berakhir di `endIso` (default hari ini). */
export function lastDaysRange(endIso = todayIsoDate(), days = 30): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(addDaysIso(endIso, -i))
  }
  return out
}

export function readBrowserGeo(): Promise<GeoPoint | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(undefined)
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            Number.isFinite(pos.coords.accuracy) && pos.coords.accuracy > 0
              ? pos.coords.accuracy
              : undefined,
        })
      },
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  })
}

export function hasGeo(point?: GeoPoint): boolean {
  return Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lng) <= 180,
  )
}
