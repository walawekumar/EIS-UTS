import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { useAuth } from '@/features/auth/AuthContext'
import { buildInbox } from '@/features/inbox/build-inbox'
import type { InboxItem } from '@/features/inbox/inbox-data'
import type { UnlockImpactRole } from '@/features/keuangan/period-data'
import { usePeriodStore } from '@/features/keuangan/period-store'
import { usePayrollStore } from '@/features/payroll/payroll-store'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import { usePenjualan } from '@/features/penjualan/PenjualanContext'
import { useProduksi } from '@/features/produksi/ProduksiContext'
import { ROLE_LABELS } from '@/types/auth'

const KIND_LABEL: Record<InboxItem['kind'], string> = {
  sale_return: 'Retur jual',
  purchase_return: 'Retur beli',
  purchase_budget: 'Anggaran PO',
  batch: 'Batch produksi',
  payroll: 'Payroll',
  period_unlock: 'Unlock periode',
}

function formatWhen(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function sourceId(item: InboxItem): string {
  const i = item.id.indexOf(':')
  return i >= 0 ? item.id.slice(i + 1) : item.id
}

export function InboxPage() {
  const { user } = useAuth()
  const { returns: saleReturns, approveSaleReturn, rejectSaleReturn } =
    usePenjualan()
  const {
    returns: purchaseReturns,
    purchases,
    approvePurchaseReturn,
    rejectPurchaseReturn,
    approvePurchase,
    rejectPurchase,
  } = usePembelian()
  const { batches, approveBatch, rejectBatch } = useProduksi()
  const { runs, approveAsAdmin, approveAsKeuangan, rejectRun } =
    usePayrollStore()
  const {
    locks,
    unlockRequests,
    approveUnlockRole,
    approveUnlockAdmin,
    rejectUnlock,
  } = usePeriodStore()

  const [toast, setToast] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const items = useMemo(() => {
    if (!user) return []
    return buildInbox({
      role: user.role,
      saleReturns,
      purchaseReturns,
      purchases,
      batches,
      payrollRuns: runs,
      unlockRequests,
      periodLocks: locks,
    })
  }, [
    user,
    saleReturns,
    purchaseReturns,
    purchases,
    batches,
    runs,
    unlockRequests,
    locks,
  ])

  if (!user) return null
  const role = user.role
  const actor = user

  function notify(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  function canAct(item: InboxItem): boolean {
    if (!item.actorRoles.includes(role)) return false
    if (item.kind !== 'period_unlock') return true
    const req = unlockRequests.find((r) => r.id === sourceId(item))
    if (!req) return false
    if (role === 'admin') {
      return (
        req.requiredRoles.every((r) =>
          req.approvals.some((a) => a.role === r),
        ) && !req.adminApproval
      )
    }
    return (
      req.requiredRoles.includes(role) &&
      !req.approvals.some((a) => a.role === role)
    )
  }

  async function onApprove(item: InboxItem) {
    const id = sourceId(item)
    let err: string | undefined
    if (item.kind === 'sale_return') err = approveSaleReturn(id)
    else if (item.kind === 'purchase_return') err = approvePurchaseReturn(id)
    else if (item.kind === 'purchase_budget') err = approvePurchase(id)
    else if (item.kind === 'batch') {
      approveBatch(id)
    } else if (item.kind === 'payroll') {
      err =
        role === 'admin' ? approveAsAdmin(id) : approveAsKeuangan(id)
    } else if (item.kind === 'period_unlock') {
      const at = new Date().toISOString()
      const by = actor.name
      if (role === 'admin') {
        err = await approveUnlockAdmin(id, { role: 'admin', by, at })
      } else {
        err = await approveUnlockRole(id, {
          role: role as UnlockImpactRole,
          by,
          at,
        })
      }
    }
    if (err) notify(err)
    else notify('Disetujui')
  }

  async function onRejectConfirm() {
    if (!rejectId) return
    const item = items.find((i) => i.id === rejectId)
    if (!item) return
    const id = sourceId(item)
    const reason = rejectReason.trim() || 'Ditolak dari kotak masuk'
    let err: string | undefined
    if (item.kind === 'sale_return') err = rejectSaleReturn(id, reason)
    else if (item.kind === 'purchase_return')
      err = rejectPurchaseReturn(id, reason)
    else if (item.kind === 'purchase_budget') err = rejectPurchase(id, reason)
    else if (item.kind === 'batch') rejectBatch(id, reason)
    else if (item.kind === 'period_unlock')
      err = await rejectUnlock(id, actor.name, reason)
    else if (item.kind === 'payroll') err = rejectRun(id, reason)
    setRejectId(null)
    setRejectReason('')
    if (err) notify(err)
    else notify('Ditolak')
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Kotak masuk</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Pengajuan menunggu tindakan · {ROLE_LABELS[role]}
            </p>
          </div>
          <FinanceToast message={toast} />
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-ink">
              Tidak ada pengajuan menunggu
            </p>
            <p className="mt-1 max-w-sm text-[12px] text-muted">
              Retur, approve anggaran, batch, payroll, dan unlock periode akan
              muncul di sini saat menunggu tindakan Anda.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70 rounded-xl border border-line">
            {items.map((item) => {
              const expanded = openId === item.id
              return (
                <li key={item.id} className="px-3.5 py-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        setOpenId((cur) => (cur === item.id ? null : item.id))
                      }
                      aria-expanded={expanded}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-ink">
                          {item.title}
                        </p>
                        <StatusPill label={item.statusLabel} tone="warn" />
                        <span className="text-[11px] text-muted">
                          {KIND_LABEL[item.kind]}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-muted">
                        {item.subtitle}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {formatWhen(item.createdAt)}
                        <span className="ml-2 text-brand-800">
                          {expanded ? 'Sembunyikan detail' : 'Lihat detail'}
                        </span>
                      </p>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <Link
                        to={item.href}
                        className="inline-flex h-9 items-center rounded-xl border border-line px-3 text-[12px] font-medium text-ink transition hover:bg-brand-50"
                      >
                        Buka modul
                      </Link>
                      {canAct(item) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onApprove(item)}
                            className="inline-flex h-9 items-center rounded-xl bg-brand-800 px-3 text-[12px] font-semibold text-white transition hover:bg-brand-900"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectId(item.id)
                              setRejectReason('')
                            }}
                            className="inline-flex h-9 items-center rounded-xl border border-red-200 px-3 text-[12px] font-medium text-red-700 transition hover:bg-red-50"
                          >
                            Tolak
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className="motion-collapse"
                    data-open={expanded ? 'true' : 'false'}
                  >
                    <div>
                      <div className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                          Detail pengajuan
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {item.details.map((line) => (
                            <li
                              key={line}
                              className="text-[13px] leading-snug text-ink"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {rejectId ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3 sm:items-center">
          <button
            type="button"
            aria-label="Tutup"
            className="motion-backdrop absolute inset-0"
            onClick={() => setRejectId(null)}
          />
          <div className="motion-panel relative w-full max-w-md rounded-2xl border border-line bg-panel p-4 shadow-lg">
            <h3 className="text-[14px] font-semibold text-ink">Tolak pengajuan</h3>
            <p className="mt-1 text-[12px] text-muted">Alasan penolakan</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-[13px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              placeholder="Contoh: dokumen belum lengkap"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="h-9 rounded-xl border border-line px-3 text-[12px] font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onRejectConfirm}
                className="h-9 rounded-xl bg-red-700 px-3 text-[12px] font-semibold text-white"
              >
                Tolak
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
