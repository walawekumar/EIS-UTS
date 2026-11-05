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
import type { ApprovalStamp } from '@/features/workflow/approvals'
import {
  hasApproval,
  upsertApproval,
} from '@/features/workflow/approvals'
import type {
  PeriodLock,
  PeriodSnapshot,
  UnlockRequest,
} from '@/features/keuangan/period-data'
import {
  computeRequiredRoles,
  type ImpactSources,
} from '@/features/keuangan/period-impact'
import {
  locksOverlap,
  monthBounds,
} from '@/features/keuangan/period-helpers'
import { periodRepository } from '@/features/keuangan/period-storage'
import { mapSupabaseError } from '@/features/master/master-cloud'
import { setCloudPersistError } from '@/lib/cloud-persist-bus'
import {
  isRelationalEnabled,
  setRelationalCache,
} from '@/lib/cloud-relational'
import { projectPeriod } from '@/lib/ops-relational/mappers/period'
import { getSupabase } from '@/lib/supabase-client'

function nextLockId(): string {
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function nextRequestId(): string {
  return `ur-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function syncPeriodCache(
  locks: PeriodLock[],
  unlockRequests: UnlockRequest[],
): void {
  const snap: PeriodSnapshot = {
    version: 1,
    locks,
    unlockRequests,
    updatedAt: new Date().toISOString(),
  }
  const parts = projectPeriod(snap)
  setRelationalCache('period_locks', parts.period_locks ?? [])
  setRelationalCache('period_unlock_requests', parts.period_unlock_requests ?? [])
}

type PeriodStoreValue = {
  locks: PeriodLock[]
  unlockRequests: UnlockRequest[]
  lockMonth: (yearMonth: string, by: string) => string | undefined
  lockRange: (
    startDate: string,
    endDate: string,
    by: string,
  ) => string | undefined
  requestUnlock: (
    lockId: string,
    reason: string,
    by: string,
    impact: ImpactSources,
  ) => string | undefined
  approveUnlockRole: (
    requestId: string,
    stamp: ApprovalStamp,
  ) => Promise<string | undefined>
  approveUnlockAdmin: (
    requestId: string,
    stamp: ApprovalStamp,
  ) => Promise<string | undefined>
  rejectUnlock: (
    requestId: string,
    by: string,
    reason: string,
  ) => Promise<string | undefined>
}

const PeriodStoreContext = createContext<PeriodStoreValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const boot = periodRepository.load()
  const [locks, setLocks] = useState<PeriodLock[]>(() => [...boot.locks])
  const [unlockRequests, setUnlockRequests] = useState<UnlockRequest[]>(() => [
    ...boot.unlockRequests,
  ])
  /**
   * After RPC success the relational cache is already synced. Stay in rpc-synced
   * until the next local lock/request write so Strict Mode remounts don't
   * re-run replace-all (unlock_requests has no client UPDATE policy).
   */
  const persistMode = useRef<'auto' | 'rpc-synced'>('auto')

  useEffect(() => {
    if (persistMode.current === 'rpc-synced') {
      if (!isRelationalEnabled()) {
        periodRepository.save({
          version: 1,
          locks,
          unlockRequests,
          updatedAt: new Date().toISOString(),
        })
      }
      return
    }
    periodRepository.save({
      version: 1,
      locks,
      unlockRequests,
      updatedAt: new Date().toISOString(),
    })
  }, [locks, unlockRequests])

  const tryAddLock = useCallback(
    (
      partial: Omit<
        PeriodLock,
        'id' | 'active' | 'lockedAt' | 'unlockHistory' | 'pendingUnlockRequestId'
      >,
    ): string | undefined => {
      const range = {
        startDate: partial.startDate,
        endDate: partial.endDate,
      }
      if (range.startDate > range.endDate) {
        return 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.'
      }
      const clash = locks.find(
        (l) => l.active && locksOverlap(range, l),
      )
      if (clash) {
        return 'Rentang bentrok dengan kunci aktif yang sudah ada.'
      }
      const lock: PeriodLock = {
        ...partial,
        id: nextLockId(),
        active: true,
        lockedAt: new Date().toISOString(),
        unlockHistory: [],
      }
      persistMode.current = 'auto'
      setLocks((list) => [lock, ...list])
      return undefined
    },
    [locks],
  )

  const lockMonth = useCallback(
    (yearMonth: string, by: string): string | undefined => {
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return 'Format bulan harus YYYY-MM.'
      }
      const { startDate, endDate } = monthBounds(yearMonth)
      return tryAddLock({
        kind: 'month',
        yearMonth,
        startDate,
        endDate,
        lockedBy: by,
      })
    },
    [tryAddLock],
  )

  const lockRange = useCallback(
    (startDate: string, endDate: string, by: string): string | undefined => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        return 'Tanggal harus YYYY-MM-DD.'
      }
      return tryAddLock({
        kind: 'range',
        startDate,
        endDate,
        lockedBy: by,
      })
    },
    [tryAddLock],
  )

  const requestUnlock = useCallback(
    (
      lockId: string,
      reason: string,
      by: string,
      impact: ImpactSources,
    ): string | undefined => {
      const trimmed = reason.trim()
      if (!trimmed) return 'Alasan unlock wajib diisi.'
      const lock = locks.find((l) => l.id === lockId)
      if (!lock) return 'Kunci periode tidak ditemukan.'
      if (!lock.active) return 'Kunci sudah tidak aktif.'
      if (lock.pendingUnlockRequestId) {
        return 'Sudah ada permintaan unlock yang menunggu.'
      }
      const requiredRoles = computeRequiredRoles({
        ...impact,
        startDate: lock.startDate,
        endDate: lock.endDate,
      })
      const req: UnlockRequest = {
        id: nextRequestId(),
        periodLockId: lockId,
        reason: trimmed,
        status: 'pending',
        requiredRoles,
        approvals: [],
        createdAt: new Date().toISOString(),
        createdBy: by,
      }
      persistMode.current = 'auto'
      setUnlockRequests((list) => [req, ...list])
      setLocks((list) =>
        list.map((l) =>
          l.id === lockId
            ? { ...l, pendingUnlockRequestId: req.id }
            : l,
        ),
      )
      return undefined
    },
    [locks],
  )

  const approveUnlockRole = useCallback(
    async (
      requestId: string,
      stamp: ApprovalStamp,
    ): Promise<string | undefined> => {
      const req = unlockRequests.find((r) => r.id === requestId)
      if (!req) return 'Permintaan unlock tidak ditemukan.'
      if (req.status !== 'pending') return 'Permintaan tidak lagi menunggu.'
      if (stamp.role === 'admin') {
        return 'Gunakan persetujuan admin final.'
      }
      if (!req.requiredRoles.includes(stamp.role)) {
        return 'Role Anda tidak termasuk bagian terdampak.'
      }

      if (isRelationalEnabled()) {
        const sb = getSupabase()
        if (!sb) return 'Supabase belum dikonfigurasi.'
        const { error } = await sb.rpc('approve_period_unlock_role', {
          p_request_id: requestId,
          p_by: stamp.by,
        })
        if (error) {
          const msg = mapSupabaseError(error)
          setCloudPersistError(msg)
          return msg
        }
      }

      const nextReqs = unlockRequests.map((r) =>
        r.id === requestId
          ? { ...r, approvals: upsertApproval(r.approvals, stamp) }
          : r,
      )
      if (isRelationalEnabled()) {
        syncPeriodCache(locks, nextReqs)
        persistMode.current = 'rpc-synced'
      }
      setUnlockRequests(nextReqs)
      return undefined
    },
    [unlockRequests, locks],
  )

  const approveUnlockAdmin = useCallback(
    async (
      requestId: string,
      stamp: ApprovalStamp,
    ): Promise<string | undefined> => {
      if (stamp.role !== 'admin') {
        return 'Hanya admin yang dapat menyetujui final.'
      }
      const req = unlockRequests.find((r) => r.id === requestId)
      if (!req) return 'Permintaan unlock tidak ditemukan.'
      if (req.status !== 'pending') return 'Permintaan tidak lagi menunggu.'
      for (const role of req.requiredRoles) {
        if (!hasApproval(req.approvals, role)) {
          return `Menunggu persetujuan role ${role} terlebih dahulu.`
        }
      }

      if (isRelationalEnabled()) {
        const sb = getSupabase()
        if (!sb) return 'Supabase belum dikonfigurasi.'
        const { error } = await sb.rpc('approve_period_unlock_admin', {
          p_request_id: requestId,
          p_by: stamp.by,
        })
        if (error) {
          const msg = mapSupabaseError(error)
          setCloudPersistError(msg)
          return msg
        }
      }

      const at = stamp.at
      const nextReqs = unlockRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'approved' as const, adminApproval: stamp }
          : r,
      )
      const nextLocks = locks.map((l) => {
        if (l.id !== req.periodLockId) return l
        return {
          ...l,
          active: false,
          pendingUnlockRequestId: undefined,
          unlockHistory: [
            ...l.unlockHistory,
            {
              at,
              by: stamp.by,
              reason: req.reason,
              requestId: req.id,
            },
          ],
        }
      })
      if (isRelationalEnabled()) {
        syncPeriodCache(nextLocks, nextReqs)
        persistMode.current = 'rpc-synced'
      }
      setUnlockRequests(nextReqs)
      setLocks(nextLocks)
      return undefined
    },
    [unlockRequests, locks],
  )

  const rejectUnlock = useCallback(
    async (
      requestId: string,
      by: string,
      reason: string,
    ): Promise<string | undefined> => {
      const trimmed = reason.trim()
      if (!trimmed) return 'Alasan penolakan wajib diisi.'
      const req = unlockRequests.find((r) => r.id === requestId)
      if (!req) return 'Permintaan unlock tidak ditemukan.'
      if (req.status !== 'pending') return 'Permintaan tidak lagi menunggu.'

      if (isRelationalEnabled()) {
        const sb = getSupabase()
        if (!sb) return 'Supabase belum dikonfigurasi.'
        const { error } = await sb.rpc('reject_period_unlock', {
          p_request_id: requestId,
          p_by: by,
          p_reason: trimmed,
        })
        if (error) {
          const msg = mapSupabaseError(error)
          setCloudPersistError(msg)
          return msg
        }
      }

      const nextReqs = unlockRequests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected' as const,
              rejectedBy: by,
              rejectReason: trimmed,
            }
          : r,
      )
      const nextLocks = locks.map((l) =>
        l.id === req.periodLockId
          ? { ...l, pendingUnlockRequestId: undefined }
          : l,
      )
      if (isRelationalEnabled()) {
        syncPeriodCache(nextLocks, nextReqs)
        persistMode.current = 'rpc-synced'
      }
      setUnlockRequests(nextReqs)
      setLocks(nextLocks)
      return undefined
    },
    [unlockRequests, locks],
  )

  const value = useMemo(
    (): PeriodStoreValue => ({
      locks,
      unlockRequests,
      lockMonth,
      lockRange,
      requestUnlock,
      approveUnlockRole,
      approveUnlockAdmin,
      rejectUnlock,
    }),
    [
      locks,
      unlockRequests,
      lockMonth,
      lockRange,
      requestUnlock,
      approveUnlockRole,
      approveUnlockAdmin,
      rejectUnlock,
    ],
  )

  return (
    <PeriodStoreContext.Provider value={value}>
      {children}
    </PeriodStoreContext.Provider>
  )
}

export function usePeriodStore(): PeriodStoreValue {
  const ctx = useContext(PeriodStoreContext)
  if (!ctx) {
    throw new Error('usePeriodStore must be used within PeriodProvider')
  }
  return ctx
}
