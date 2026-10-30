import { useEffect, useMemo, useState } from 'react'
import {
  FinanceModal,
  ModalActions,
  TextAreaField,
} from '@/components/keuangan/FinanceModal'
import {
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import type { PeriodLock, UnlockRequest } from '@/features/keuangan/period-data'
import type { ImpactSources } from '@/features/keuangan/period-impact'
import { usePeriodStore } from '@/features/keuangan/period-store'
import { usePayrollStore } from '@/features/payroll/payroll-store'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import { usePenjualan } from '@/features/penjualan/PenjualanContext'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { useProduksi } from '@/features/produksi/ProduksiContext'
import { hasApproval } from '@/features/workflow/approvals'
import { ROLE_LABELS, type UserRole } from '@/types/auth'

type LockKindForm = 'month' | 'range'

function lockLabel(lock: PeriodLock): string {
  if (lock.kind === 'month' && lock.yearMonth) return lock.yearMonth
  return `${lock.startDate} – ${lock.endDate}`
}

function formatIsoDisplay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function canManageLocks(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'keuangan'
}

function buildImpactSources(input: {
  lock: PeriodLock
  orders: ReturnType<typeof usePenjualan>['orders']
  saleReturns: ReturnType<typeof usePenjualan>['returns']
  purchases: ReturnType<typeof usePembelian>['purchases']
  purchaseReturns: ReturnType<typeof usePembelian>['returns']
  batches: ReturnType<typeof useProduksi>['batches']
  packRuns: ReturnType<typeof useProduksi>['packRuns']
  movements: ReturnType<typeof usePersediaanStore>['movements']
  cashEntries: ReturnType<typeof useFinanceStore>['cashEntries']
  expenses: ReturnType<typeof useFinanceStore>['expenses']
  journals: ReturnType<typeof useFinanceStore>['journals']
  payrollRuns: ReturnType<typeof usePayrollStore>['runs']
}): ImpactSources {
  return {
    startDate: input.lock.startDate,
    endDate: input.lock.endDate,
    saleOrders: input.orders.map((o) => ({
      date: o.date,
      voidedAt: o.voidedAt,
    })),
    saleReturns: input.saleReturns.map((r) => ({
      stage: r.stage,
      postedAt: r.postedAt,
    })),
    purchases: input.purchases.map((p) => ({
      date: p.date,
      voidedAt: p.voidedAt,
    })),
    purchaseReturns: input.purchaseReturns.map((r) => ({
      stage: r.stage,
      postedAt: r.postedAt,
    })),
    batches: input.batches.map((b) => ({
      date: b.date,
      stage: b.stage,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
    })),
    packRuns: input.packRuns.map((p) => ({
      stage: p.stage,
      postedAt: p.postedAt,
    })),
    stockMovements: input.movements.map((m) => ({ date: m.date })),
    cashEntries: input.cashEntries.map((c) => ({ date: c.date })),
    expenses: input.expenses.map((e) => ({
      date: e.date,
      status: e.status,
    })),
    journals: input.journals.map((j) => ({ date: j.date })),
    payrollRuns: input.payrollRuns.map((r) => ({
      status: r.status,
      postedAt: r.postedAt,
    })),
  }
}

export function PeriodePage() {
  const { user } = useAuth()
  const {
    locks,
    unlockRequests,
    lockMonth,
    lockRange,
    requestUnlock,
    approveUnlockRole,
    approveUnlockAdmin,
    rejectUnlock,
  } = usePeriodStore()
  const { orders, returns: saleReturns } = usePenjualan()
  const { purchases, returns: purchaseReturns } = usePembelian()
  const { batches, packRuns } = useProduksi()
  const { movements } = usePersediaanStore()
  const { cashEntries, expenses, journals } = useFinanceStore()
  const { runs: payrollRuns } = usePayrollStore()

  const [toast, setToast] = useState<string | null>(null)
  const [lockKind, setLockKind] = useState<LockKindForm>('month')
  const [monthValue, setMonthValue] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false)
  const [unlockTarget, setUnlockTarget] = useState<PeriodLock | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState<UnlockRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [detailLock, setDetailLock] = useState<PeriodLock | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  const sortedLocks = useMemo(
    () =>
      [...locks].sort((a, b) => b.lockedAt.localeCompare(a.lockedAt)),
    [locks],
  )

  const pendingByLockId = useMemo(() => {
    const map = new Map<string, UnlockRequest>()
    for (const r of unlockRequests) {
      if (r.status === 'pending') map.set(r.periodLockId, r)
    }
    return map
  }, [unlockRequests])

  const impactDeps = {
    orders,
    saleReturns,
    purchases,
    purchaseReturns,
    batches,
    packRuns,
    movements,
    cashEntries,
    expenses,
    journals,
    payrollRuns,
  }

  function submitLock() {
    if (!user) return
    const by = user.name
    const err =
      lockKind === 'month'
        ? lockMonth(monthValue.trim(), by)
        : lockRange(rangeStart.trim(), rangeEnd.trim(), by)
    if (err) {
      setToast(err)
      return
    }
    setLockConfirmOpen(false)
    setMonthValue('')
    setRangeStart('')
    setRangeEnd('')
    setToast('Periode berhasil dikunci')
  }

  function submitUnlockRequest() {
    if (!user || !unlockTarget) return
    const impact = buildImpactSources({
      lock: unlockTarget,
      ...impactDeps,
    })
    const err = requestUnlock(
      unlockTarget.id,
      unlockReason,
      user.name,
      impact,
    )
    if (err) {
      setToast(err)
      return
    }
    setUnlockTarget(null)
    setUnlockReason('')
    setToast('Permintaan unlock dikirim')
  }

  function stampNow(role: UserRole): { role: UserRole; by: string; at: string } {
    return {
      role,
      by: user?.name ?? role,
      at: new Date().toISOString(),
    }
  }

  function handleApproveRole(req: UnlockRequest) {
    if (!user) return
    const err = approveUnlockRole(req.id, stampNow(user.role))
    setToast(err ?? `Persetujuan ${ROLE_LABELS[user.role]} tercatat`)
  }

  function handleApproveAdmin(req: UnlockRequest) {
    if (!user) return
    const err = approveUnlockAdmin(req.id, stampNow('admin'))
    setToast(err ?? 'Periode dibuka — kunci dinonaktifkan')
  }

  function submitReject() {
    if (!user || !rejectTarget) return
    const err = rejectUnlock(rejectTarget.id, user.name, rejectReason)
    if (err) {
      setToast(err)
      return
    }
    setRejectTarget(null)
    setRejectReason('')
    setToast('Permintaan unlock ditolak')
  }

  const manageLocks = canManageLocks(user?.role)

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Kunci periode</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Tutup buku per bulan atau rentang — unlock membutuhkan persetujuan
              role terdampak dan admin final
            </p>
          </div>
          <FinanceToast message={toast} />
        </div>

        {manageLocks ? (
          <div className="mb-4 rounded-xl border border-line/80 bg-surface p-3">
            <p className="mb-2 text-[12px] font-medium text-ink">Buat kunci baru</p>
            <div className="flex flex-wrap gap-3 text-[12px]">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="lockKind"
                  checked={lockKind === 'month'}
                  onChange={() => setLockKind('month')}
                />
                Bulan (YYYY-MM)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="lockKind"
                  checked={lockKind === 'range'}
                  onChange={() => setLockKind('range')}
                />
                Rentang tanggal
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              {lockKind === 'month' ? (
                <TextField
                  id="periode-month"
                  label="Bulan"
                  value={monthValue}
                  onChange={(e) => setMonthValue(e.target.value)}
                  placeholder="2026-10"
                />
              ) : (
                <>
                  <TextField
                    id="periode-start"
                    label="Mulai"
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                  />
                  <TextField
                    id="periode-end"
                    label="Akhir"
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                  />
                </>
              )}
              <button
                type="button"
                className="rounded-lg bg-ink px-3 py-2 text-[12px] font-medium text-white"
                onClick={() => setLockConfirmOpen(true)}
              >
                Kunci periode
              </button>
            </div>
          </div>
        ) : (
          <p className="mb-3 text-[12px] text-muted">
            Hanya admin atau keuangan yang dapat membuat kunci. Anda dapat
            menyetujui unlock jika role Anda terdampak.
          </p>
        )}

        <FinanceTable>
          <FinanceThead>
            <tr>
              <FinanceTh className="w-10">#</FinanceTh>
              <FinanceTh>Periode</FinanceTh>
              <FinanceTh>Status</FinanceTh>
              <FinanceTh>Dikunci</FinanceTh>
              <FinanceTh>Oleh</FinanceTh>
              <FinanceTh className="w-24">Aksi</FinanceTh>
            </tr>
          </FinanceThead>
          <tbody>
            {sortedLocks.length === 0 ? (
              <FinanceEmptyRow colSpan={6} message="Belum ada kunci periode" />
            ) : (
              sortedLocks.map((lock, i) => {
                const pending = pendingByLockId.get(lock.id)
                return (
                  <FinanceTr key={lock.id}>
                    <FinanceTd>{i + 1}</FinanceTd>
                    <FinanceTd>
                      <span className="font-medium">{lockLabel(lock)}</span>
                      <span className="block text-[11px] text-muted">
                        {lock.startDate} → {lock.endDate}
                      </span>
                    </FinanceTd>
                    <FinanceTd>
                      <StatusPill
                        label={lock.active ? 'Aktif' : 'Nonaktif'}
                        tone={lock.active ? 'warn' : 'muted'}
                      />
                      {pending ? (
                        <span className="ml-1 inline-block">
                          <StatusPill label="Unlock pending" tone="neutral" />
                        </span>
                      ) : null}
                    </FinanceTd>
                    <FinanceTd>{formatIsoDisplay(lock.lockedAt)}</FinanceTd>
                    <FinanceTd>{lock.lockedBy}</FinanceTd>
                    <FinanceTd>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-muted hover:bg-surface hover:text-ink"
                          title="Detail"
                          onClick={() => setDetailLock(lock)}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {manageLocks && lock.active && !pending ? (
                          <button
                            type="button"
                            className="text-[11px] text-amber-800 underline"
                            onClick={() => {
                              setUnlockTarget(lock)
                              setUnlockReason('')
                            }}
                          >
                            Minta unlock
                          </button>
                        ) : null}
                      </div>
                    </FinanceTd>
                  </FinanceTr>
                )
              })
            )}
          </tbody>
        </FinanceTable>
      </section>

      {unlockRequests.some((r) => r.status === 'pending') ? (
        <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
          <h3 className="text-[13px] font-semibold text-ink">
            Persetujuan unlock
          </h3>
          <p className="mb-3 text-[12px] text-muted">
            Hanya role yang terdampak transaksi di periode yang diminta
          </p>
          <div className="space-y-3">
            {unlockRequests
              .filter((r) => r.status === 'pending')
              .map((req) => {
                const lock = locks.find((l) => l.id === req.periodLockId)
                const allRolesDone = req.requiredRoles.every((role) =>
                  hasApproval(req.approvals, role),
                )
                const canReject =
                  user?.role === 'admin' ||
                  (user?.role != null &&
                    req.requiredRoles.includes(
                      user.role as (typeof req.requiredRoles)[number],
                    ))
                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-line/80 bg-surface p-3"
                  >
                    <p className="text-[12px] font-medium text-ink">
                      {lock ? lockLabel(lock) : req.periodLockId}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {req.reason} · oleh {req.createdBy}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {req.requiredRoles.map((role) => (
                        <StatusPill
                          key={role}
                          label={`${ROLE_LABELS[role]}${hasApproval(req.approvals, role) ? ' ✓' : ''}`}
                          tone={
                            hasApproval(req.approvals, role) ? 'good' : 'warn'
                          }
                        />
                      ))}
                      {req.requiredRoles.length === 0 ? (
                        <span className="text-[11px] text-muted">
                          Tidak ada role ops terdampak — admin final saja
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {req.requiredRoles.map((role) => {
                        if (user?.role !== role) return null
                        if (hasApproval(req.approvals, role)) return null
                        return (
                          <button
                            key={role}
                            type="button"
                            className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium"
                            onClick={() => handleApproveRole(req)}
                          >
                            Setujui sebagai {ROLE_LABELS[role]}
                          </button>
                        )
                      })}
                      {user?.role === 'admin' &&
                      (allRolesDone || req.requiredRoles.length === 0) ? (
                        <button
                          type="button"
                          className="rounded-lg bg-ink px-2 py-1 text-[11px] font-medium text-white"
                          onClick={() => handleApproveAdmin(req)}
                        >
                          Admin final — buka periode
                        </button>
                      ) : null}
                      {canReject ? (
                        <button
                          type="button"
                          className="text-[11px] text-red-700 underline"
                          onClick={() => {
                            setRejectTarget(req)
                            setRejectReason('')
                          }}
                        >
                          Tolak
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      ) : null}

      {lockConfirmOpen ? (
        <FinanceModal
          title="Konfirmasi kunci periode"
          onClose={() => setLockConfirmOpen(false)}
          footer={
            <ModalActions
              onCancel={() => setLockConfirmOpen(false)}
              onConfirm={submitLock}
              confirmLabel="Kunci"
            />
          }
        >
          <p className="text-[12px] text-muted">
            Posting dengan tanggal di dalam periode ini akan diblokir hingga
            unlock disetujui.
          </p>
        </FinanceModal>
      ) : null}

      {unlockTarget ? (
        <FinanceModal
          title="Permintaan unlock"
          onClose={() => setUnlockTarget(null)}
          footer={
            <ModalActions
              onCancel={() => setUnlockTarget(null)}
              onConfirm={submitUnlockRequest}
              confirmLabel="Kirim permintaan"
            />
          }
        >
          <TextAreaField
            id="unlock-reason"
            label="Alasan unlock"
            value={unlockReason}
            onChange={setUnlockReason}
            rows={3}
          />
        </FinanceModal>
      ) : null}

      {rejectTarget ? (
        <FinanceModal
          title="Tolak permintaan unlock"
          onClose={() => setRejectTarget(null)}
          footer={
            <ModalActions
              onCancel={() => setRejectTarget(null)}
              onConfirm={submitReject}
              confirmLabel="Tolak"
              danger
            />
          }
        >
          <TextAreaField
            id="reject-reason"
            label="Alasan penolakan"
            value={rejectReason}
            onChange={setRejectReason}
            rows={3}
          />
        </FinanceModal>
      ) : null}

      {detailLock ? (
        <DetailDrawer
          open
          onClose={() => setDetailLock(null)}
          title="Detail kunci periode"
        >
          <DrawerSection label="Periode">
            <p className="text-[13px]">{lockLabel(detailLock)}</p>
            <p className="text-[11px] text-muted">
              {detailLock.startDate} – {detailLock.endDate}
            </p>
          </DrawerSection>
          <DrawerSection label="Audit">
            <p className="text-[12px]">
              Dikunci {formatIsoDisplay(detailLock.lockedAt)} oleh{' '}
              {detailLock.lockedBy}
            </p>
          </DrawerSection>
          {detailLock.unlockHistory.length > 0 ? (
            <DrawerSection label="Riwayat unlock">
              <ul className="space-y-1 text-[11px] text-muted">
                {detailLock.unlockHistory.map((h, idx) => (
                  <li key={idx}>
                    {formatIsoDisplay(h.at)} · {h.by}: {h.reason}
                  </li>
                ))}
              </ul>
            </DrawerSection>
          ) : null}
        </DetailDrawer>
      ) : null}
    </div>
  )
}
