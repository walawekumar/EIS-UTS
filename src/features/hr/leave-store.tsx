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
import { useAbsensiStore } from '@/features/absensi/absensi-store'
import { useAuditStore } from '@/features/audit/audit-store'
import { useAuth } from '@/features/auth/AuthContext'
import {
  countWorkdays,
  eachWorkday,
  hasProof,
  leaveAttendanceStatus,
  nextLeaveId,
  usedCutiDays,
  DEFAULT_CUTI_QUOTA,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from '@/features/hr/leave-data'
import {
  loadLeaveCloud,
  mapSupabaseError,
  upsertLeaveCloud,
} from '@/features/hr/leave-cloud'
import { leaveRepository } from '@/features/hr/leave-storage'
import type { ProofAttachment } from '@/features/workflow/proof'
import { isSupabaseConfigured } from '@/lib/supabase-client'

type LeaveStoreValue = {
  requests: LeaveRequest[]
  ready: boolean
  persistError: string | null
  cutiUsed: number
  cutiQuota: number
  submitLeave: (input: {
    leaveType: LeaveType
    startDate: string
    endDate: string
    reason: string
    proof: ProofAttachment | string
  }) => Promise<string | undefined>
  cancelLeave: (id: string) => Promise<string | undefined>
  /** HR atau admin — hanya pending; alasan wajib. */
  approveLeave: (id: string, note: string) => Promise<string | undefined>
  rejectLeave: (id: string, note: string) => Promise<string | undefined>
  /** Admin saja — ubah keputusan HR (approved/rejected) dengan alasan. */
  overrideLeave: (
    id: string,
    status: 'approved' | 'rejected',
    note: string,
  ) => Promise<string | undefined>
}

const LeaveContext = createContext<LeaveStoreValue | null>(null)

function canReview(role: string | undefined): boolean {
  return role === 'admin' || role === 'hr'
}

export function LeaveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { appendAudit } = useAuditStore()
  const { upsertAttendanceDays } = useAbsensiStore()
  const configured = isSupabaseConfigured()
  const [requests, setRequests] = useState<LeaveRequest[]>(() =>
    configured ? [] : leaveRepository.load().requests,
  )
  const [ready, setReady] = useState(!configured)
  const [cloudOk, setCloudOk] = useState(!configured)
  const [persistError, setPersistError] = useState<string | null>(null)
  const skipPersist = useRef(configured)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadLeaveCloud()
        if (cancelled) return
        skipPersist.current = true
        setRequests(rows)
        setCloudOk(true)
        setPersistError(null)
        setReady(true)
      } catch (e) {
        if (cancelled) return
        skipPersist.current = true
        setRequests(leaveRepository.load().requests)
        setCloudOk(false)
        setPersistError(
          `${mapSupabaseError(e)} Cuti memakai penyimpanan lokal sementara.`,
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
    leaveRepository.save({ version: 1, requests })
  }, [ready, requests])

  const year = new Date().getFullYear()
  const cutiUsed = user ? usedCutiDays(requests, user.id, year) : 0

  const persistRow = useCallback(
    async (row: LeaveRequest): Promise<string | undefined> => {
      if (configured && cloudOk) {
        try {
          await upsertLeaveCloud(row)
          setPersistError(null)
          return undefined
        } catch (e) {
          leaveRepository.save({ version: 1, requests })
          const msg = mapSupabaseError(e)
          setPersistError(`${msg} Disimpan lokal (cloud gagal).`)
          return msg
        }
      }
      return undefined
    },
    [configured, cloudOk, requests],
  )

  const stampAttendance = useCallback(
    async (current: LeaveRequest) => {
      const status = leaveAttendanceStatus(current.leaveType)
      const days = eachWorkday(current.startDate, current.endDate).map(
        (date) => ({
          id: `abs-${date}-${current.userId}`,
          userId: current.userId,
          userName: current.userName,
          date,
          status,
          note: `Cuti/izin ${current.id}: ${current.leaveType}`,
        }),
      )
      return upsertAttendanceDays(days)
    },
    [upsertAttendanceDays],
  )

  const submitLeave = useCallback(
    async (input: {
      leaveType: LeaveType
      startDate: string
      endDate: string
      reason: string
      proof: ProofAttachment | string
    }): Promise<string | undefined> => {
      if (!user) return 'Anda belum masuk.'
      if (!ready) return 'Data cuti masih memuat…'
      const days = countWorkdays(input.startDate, input.endDate)
      if (days <= 0) {
        return 'Rentang tanggal tidak valid (butuh hari kerja Sen–Jum).'
      }
      if (!input.reason.trim()) return 'Alasan pengajuan wajib diisi.'
      if (!hasProof(input.proof)) {
        return 'Bukti lampiran wajib (surat/dokumen pendukung).'
      }
      if (
        input.leaveType === 'cuti' &&
        cutiUsed + days > DEFAULT_CUTI_QUOTA
      ) {
        return `Sisa kuota cuti tidak cukup (terpakai ${cutiUsed}/${DEFAULT_CUTI_QUOTA}).`
      }
      const row: LeaveRequest = {
        id: nextLeaveId(requests),
        userId: user.id,
        userName: user.name,
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        reason: input.reason.trim(),
        proof: input.proof,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setRequests((list) => [row, ...list])
      appendAudit({
        action: 'create',
        entity: 'leave',
        entityId: row.id,
        after: row,
        note: `Pengajuan ${row.leaveType} + bukti`,
      })
      return persistRow(row)
    },
    [user, ready, requests, cutiUsed, appendAudit, persistRow],
  )

  const cancelLeave = useCallback(
    async (id: string): Promise<string | undefined> => {
      if (!user) return 'Anda belum masuk.'
      const current = requests.find((r) => r.id === id)
      if (!current) return 'Pengajuan tidak ditemukan.'
      if (current.userId !== user.id) {
        return 'Hanya pemohon yang bisa membatalkan.'
      }
      if (current.status !== 'pending') {
        return 'Hanya pengajuan pending yang bisa dibatalkan.'
      }
      const next: LeaveRequest = { ...current, status: 'cancelled' }
      setRequests((list) => list.map((r) => (r.id === id ? next : r)))
      appendAudit({
        action: 'update',
        entity: 'leave',
        entityId: id,
        before: current,
        after: next,
        note: 'Batalkan pengajuan',
      })
      return persistRow(next)
    },
    [user, requests, appendAudit, persistRow],
  )

  const approveLeave = useCallback(
    async (id: string, note: string): Promise<string | undefined> => {
      if (!canReview(user?.role)) {
        return 'Hanya HR atau admin yang dapat menyetujui.'
      }
      if (!note.trim()) return 'Alasan persetujuan wajib diisi.'
      const current = requests.find((r) => r.id === id)
      if (!current || current.status !== 'pending') {
        return 'Pengajuan tidak menunggu persetujuan.'
      }
      if (!hasProof(current.proof)) {
        return 'Pengajuan tanpa bukti tidak dapat disetujui.'
      }
      const next: LeaveRequest = {
        ...current,
        status: 'approved',
        reviewedBy: user!.name,
        reviewedAt: new Date().toISOString(),
        reviewNote: note.trim(),
      }
      setRequests((list) => list.map((r) => (r.id === id ? next : r)))
      const stampErr = await stampAttendance(current)
      appendAudit({
        action: 'approve',
        entity: 'leave',
        entityId: id,
        before: current,
        after: next,
        note: note.trim(),
      })
      const persistErr = await persistRow(next)
      return stampErr ?? persistErr
    },
    [user, requests, stampAttendance, appendAudit, persistRow],
  )

  const rejectLeave = useCallback(
    async (id: string, note: string): Promise<string | undefined> => {
      if (!canReview(user?.role)) {
        return 'Hanya HR atau admin yang dapat menolak.'
      }
      if (!note.trim()) return 'Alasan penolakan wajib diisi.'
      const current = requests.find((r) => r.id === id)
      if (!current || current.status !== 'pending') {
        return 'Pengajuan tidak menunggu persetujuan.'
      }
      const next: LeaveRequest = {
        ...current,
        status: 'rejected',
        reviewedBy: user!.name,
        reviewedAt: new Date().toISOString(),
        reviewNote: note.trim(),
      }
      setRequests((list) => list.map((r) => (r.id === id ? next : r)))
      appendAudit({
        action: 'reject',
        entity: 'leave',
        entityId: id,
        before: current,
        after: next,
        note: note.trim(),
      })
      return persistRow(next)
    },
    [user, requests, appendAudit, persistRow],
  )

  const overrideLeave = useCallback(
    async (
      id: string,
      status: Extract<LeaveStatus, 'approved' | 'rejected'>,
      note: string,
    ): Promise<string | undefined> => {
      if (user?.role !== 'admin') {
        return 'Hanya admin yang dapat override keputusan HR.'
      }
      if (!note.trim()) return 'Alasan override wajib diisi.'
      const current = requests.find((r) => r.id === id)
      if (!current) return 'Pengajuan tidak ditemukan.'
      if (current.status !== 'approved' && current.status !== 'rejected') {
        return 'Override hanya untuk pengajuan yang sudah diputuskan HR.'
      }
      if (current.status === status) {
        return `Status sudah ${status === 'approved' ? 'disetujui' : 'ditolak'}.`
      }
      const next: LeaveRequest = {
        ...current,
        status,
        overriddenBy: user.name,
        overriddenAt: new Date().toISOString(),
        overrideNote: note.trim(),
        reviewedBy: current.reviewedBy ?? user.name,
        reviewedAt: current.reviewedAt ?? new Date().toISOString(),
        reviewNote: current.reviewNote,
      }
      setRequests((list) => list.map((r) => (r.id === id ? next : r)))
      let stampErr: string | undefined
      if (status === 'approved') {
        stampErr = await stampAttendance(current)
      }
      appendAudit({
        action: status === 'approved' ? 'approve' : 'reject',
        entity: 'leave',
        entityId: id,
        before: current,
        after: next,
        note: `Override admin: ${note.trim()}`,
      })
      const persistErr = await persistRow(next)
      return stampErr ?? persistErr
    },
    [user, requests, stampAttendance, appendAudit, persistRow],
  )

  const value = useMemo(
    (): LeaveStoreValue => ({
      requests,
      ready,
      persistError,
      cutiUsed,
      cutiQuota: DEFAULT_CUTI_QUOTA,
      submitLeave,
      cancelLeave,
      approveLeave,
      rejectLeave,
      overrideLeave,
    }),
    [
      requests,
      ready,
      persistError,
      cutiUsed,
      submitLeave,
      cancelLeave,
      approveLeave,
      rejectLeave,
      overrideLeave,
    ],
  )

  return (
    <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>
  )
}

export function useLeaveStore(): LeaveStoreValue {
  const ctx = useContext(LeaveContext)
  if (!ctx) throw new Error('useLeaveStore harus di dalam LeaveProvider')
  return ctx
}
