import type {
  AttendanceRecord,
  AttendanceStatus,
  GeoPoint,
} from '@/features/absensi/absensi-data'
import { mapSupabaseError } from '@/features/master/master-cloud'
import { getSupabase } from '@/lib/supabase-client'

export { mapSupabaseError }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AttendanceDbRow = {
  id: string
  user_id: string
  user_name: string
  work_date: string
  check_in: string | null
  check_out: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_in_accuracy: number | null
  check_out_lat: number | null
  check_out_lng: number | null
  check_out_accuracy: number | null
  status: AttendanceStatus
  note: string
}

function asFiniteNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

function geoFrom(
  lat: unknown,
  lng: unknown,
  accuracy: unknown,
): GeoPoint | undefined {
  const la = asFiniteNumber(lat)
  const ln = asFiniteNumber(lng)
  if (la == null || ln == null) return undefined
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return undefined
  const acc = asFiniteNumber(accuracy)
  return {
    lat: la,
    lng: ln,
    accuracy: acc != null && acc > 0 ? acc : undefined,
  }
}

function fromRow(row: AttendanceDbRow): AttendanceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    date: row.work_date,
    checkIn: row.check_in ?? undefined,
    checkOut: row.check_out ?? undefined,
    checkInGeo: geoFrom(row.check_in_lat, row.check_in_lng, row.check_in_accuracy),
    checkOutGeo: geoFrom(
      row.check_out_lat,
      row.check_out_lng,
      row.check_out_accuracy,
    ),
    status: row.status,
    note: row.note || undefined,
  }
}

function toRow(row: AttendanceRecord): AttendanceDbRow {
  return {
    id: row.id,
    user_id: row.userId,
    user_name: row.userName,
    work_date: row.date,
    check_in: row.checkIn ?? null,
    check_out: row.checkOut ?? null,
    check_in_lat: row.checkInGeo?.lat ?? null,
    check_in_lng: row.checkInGeo?.lng ?? null,
    check_in_accuracy: row.checkInGeo?.accuracy ?? null,
    check_out_lat: row.checkOutGeo?.lat ?? null,
    check_out_lng: row.checkOutGeo?.lng ?? null,
    check_out_accuracy: row.checkOutGeo?.accuracy ?? null,
    status: row.status,
    note: row.note ?? '',
  }
}

function mapAbsensiError(err: unknown): string {
  const msg = mapSupabaseError(err)
  if (/PGRST205|Could not find the table|schema cache/i.test(msg)) {
    return 'Tabel absensi belum ada di cloud. Jalankan migrasi 20261105_08_absensi.'
  }
  if (/check_in_lat|PGRST204/i.test(msg)) {
    return 'Kolom lokasi absensi belum ada. Jalankan migrasi 20261105_12_attendance_geo.'
  }
  return msg
}

export async function loadAbsensiCloud(): Promise<AttendanceRecord[]> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await sb
    .from('attendance_records')
    .select('*')
    .order('work_date', { ascending: false })
  if (error) throw new Error(mapAbsensiError(error))
  return ((data ?? []) as AttendanceDbRow[]).map(fromRow)
}

export async function saveAbsensiCloudForUser(
  userId: string,
  records: AttendanceRecord[],
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  if (!UUID_RE.test(userId)) {
    throw new Error('ID pengguna bukan UUID Auth, tidak bisa sync absensi cloud.')
  }

  const mine = records.filter((r) => r.userId === userId)
  for (const row of mine) {
    if (!UUID_RE.test(row.userId)) {
      throw new Error('ID pengguna bukan UUID Auth, tidak bisa sync absensi cloud.')
    }
  }

  if (mine.length) {
    const { error } = await sb.from('attendance_records').upsert(mine.map(toRow))
    if (error) throw new Error(mapAbsensiError(error))
  }
}

export async function upsertAbsensiCloudRows(
  records: AttendanceRecord[],
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const valid = records.filter((r) => UUID_RE.test(r.userId))
  if (!valid.length) return
  const { error } = await sb.from('attendance_records').upsert(valid.map(toRow))
  if (error) throw new Error(mapAbsensiError(error))
}

export async function saveAbsensiCloud(
  records: AttendanceRecord[],
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const valid = records.filter((r) => UUID_RE.test(r.userId))
  if (valid.length) {
    const { error } = await sb.from('attendance_records').upsert(valid.map(toRow))
    if (error) throw new Error(mapAbsensiError(error))
  }
}
