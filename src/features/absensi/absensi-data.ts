export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpha'

export type AttendanceRecord = {
  id: string
  userId: string
  userName: string
  date: string
  checkIn?: string
  checkOut?: string
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
  if (!iso) return ','
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ','
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
