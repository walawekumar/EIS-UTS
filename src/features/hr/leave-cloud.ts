import type { LeaveRequest, LeaveStatus, LeaveType } from '@/features/hr/leave-data'
import { mapSupabaseError } from '@/features/master/master-cloud'
import type { ProofAttachment } from '@/features/workflow/proof'
import { getSupabase } from '@/lib/supabase-client'

export { mapSupabaseError }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type LeaveDbRow = {
  id: string
  user_id: string
  user_name: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  reason: string
  proof: ProofAttachment | string | null
  status: LeaveStatus
  reviewed_by: string
  reviewed_at: string | null
  review_note: string
  overridden_by: string
  overridden_at: string | null
  override_note: string
  created_at: string
}

function fromRow(row: LeaveDbRow): LeaveRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: Number(row.days),
    reason: row.reason,
    proof: row.proof ?? undefined,
    status: row.status,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewNote: row.review_note || undefined,
    overriddenBy: row.overridden_by || undefined,
    overriddenAt: row.overridden_at ?? undefined,
    overrideNote: row.override_note || undefined,
    createdAt: row.created_at,
  }
}

function toRow(row: LeaveRequest): LeaveDbRow {
  return {
    id: row.id,
    user_id: row.userId,
    user_name: row.userName,
    leave_type: row.leaveType,
    start_date: row.startDate,
    end_date: row.endDate,
    days: row.days,
    reason: row.reason,
    proof: row.proof ?? null,
    status: row.status,
    reviewed_by: row.reviewedBy ?? '',
    reviewed_at: row.reviewedAt ?? null,
    review_note: row.reviewNote ?? '',
    overridden_by: row.overriddenBy ?? '',
    overridden_at: row.overriddenAt ?? null,
    override_note: row.overrideNote ?? '',
    created_at: row.createdAt,
  }
}

function mapLeaveError(err: unknown): string {
  const msg = mapSupabaseError(err)
  if (/PGRST205|Could not find the table|schema cache/i.test(msg)) {
    return 'Tabel cuti belum ada di cloud. Jalankan migrasi 20261105_10_hr_leave_payroll.'
  }
  if (/proof|PGRST204|column/i.test(msg) && /proof/i.test(msg)) {
    return 'Kolom bukti cuti belum ada. Jalankan migrasi 20261105_11_leave_proof_override.'
  }
  return msg
}

export async function loadLeaveCloud(): Promise<LeaveRequest[]> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(mapLeaveError(error))
  return ((data ?? []) as LeaveDbRow[]).map(fromRow)
}

export async function upsertLeaveCloud(row: LeaveRequest): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  if (!UUID_RE.test(row.userId)) {
    throw new Error('ID pengguna bukan UUID Auth, tidak bisa sync cuti cloud.')
  }
  const { error } = await sb.from('leave_requests').upsert(toRow(row))
  if (error) throw new Error(mapLeaveError(error))
}
