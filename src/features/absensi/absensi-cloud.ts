import type { AttendanceRecord, AttendanceStatus } from '@/features/absensi/absensi-data'
import { mapSupabaseError } from '@/features/master/master-cloud'
import { getSupabase } from '@/lib/supabase-client'

export { mapSupabaseError }

type AttendanceDbRow = {
  id: string
  user_id: string
  user_name: string
  work_date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  note: string
}

function fromRow(row: AttendanceDbRow): AttendanceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    date: row.work_date,
    checkIn: row.check_in ?? undefined,
    checkOut: row.check_out ?? undefined,
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
    status: row.status,
    note: row.note ?? '',
  }
}

export async function loadAbsensiCloud(): Promise<AttendanceRecord[]> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await sb
    .from('attendance_records')
    .select('*')
    .order('work_date', { ascending: false })
  if (error) throw error
  return ((data ?? []) as AttendanceDbRow[]).map(fromRow)
}

export async function saveAbsensiCloud(
  records: AttendanceRecord[],
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')

  if (records.length) {
    const { error } = await sb.from('attendance_records').upsert(records.map(toRow))
    if (error) throw error
  }

  const { data: existing, error: listErr } = await sb
    .from('attendance_records')
    .select('id')
  if (listErr) throw listErr
  const existingIds = (existing ?? []).map((r) => r.id as string)
  if (records.length === 0 && existingIds.length > 0) {
    throw new Error(
      'Menolak hapus semua absensi, payload kosong sementara remote masih berisi data.',
    )
  }
  const keep = new Set(records.map((r) => r.id))
  const drop = existingIds.filter((id) => !keep.has(id))
  if (drop.length) {
    const { error } = await sb.from('attendance_records').delete().in('id', drop)
    if (error) throw error
  }
}
