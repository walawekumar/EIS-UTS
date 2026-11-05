import type { ProofAttachment } from '@/features/workflow/proof'
import { hasProof } from '@/features/workflow/proof'

export type LeaveType = 'cuti' | 'izin' | 'sakit' | 'dinas'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type LeaveRequest = {
  id: string
  userId: string
  userName: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  proof?: ProofAttachment | string
  status: LeaveStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  overriddenBy?: string
  overriddenAt?: string
  overrideNote?: string
  createdAt: string
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  cuti: 'Cuti',
  izin: 'Izin',
  sakit: 'Sakit',
  dinas: 'Dinas',
}

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
}

export const DEFAULT_CUTI_QUOTA = 12

export { hasProof }

/** Hari kerja Sen–Jum antara start..end (inklusif). */
export function countWorkdays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0
  }
  let n = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) n += 1
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export function eachWorkday(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return out
  }
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      out.push(`${y}-${m}-${d}`)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function leaveAttendanceStatus(
  leaveType: LeaveType,
): 'izin' | 'sakit' {
  return leaveType === 'sakit' ? 'sakit' : 'izin'
}

export function nextLeaveId(list: LeaveRequest[]): string {
  const max = list.reduce((m, row) => {
    const n = Number(String(row.id).replace(/\D/g, ''))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `LV-${String(max + 1).padStart(4, '0')}`
}

export function usedCutiDays(
  list: LeaveRequest[],
  userId: string,
  year: number,
): number {
  return list
    .filter(
      (r) =>
        r.userId === userId &&
        r.leaveType === 'cuti' &&
        r.status === 'approved' &&
        r.startDate.startsWith(String(year)),
    )
    .reduce((s, r) => s + r.days, 0)
}

export function proofPreviewUrl(
  proof: ProofAttachment | string | undefined,
): string | undefined {
  if (!proof) return undefined
  if (typeof proof === 'string') {
    return proof.startsWith('http') ? proof : undefined
  }
  return proof.previewUrl
}

export function proofDisplayName(
  proof: ProofAttachment | string | undefined,
): string {
  if (!proof) return '—'
  return typeof proof === 'string' ? proof : proof.name
}
