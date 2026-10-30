import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuditStore } from '@/features/audit/audit-store'
import { useAuth } from '@/features/auth/AuthContext'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import {
  addDays,
  calcWeighing,
  effectiveUnitPrice,
  getSupplier,
  nextLotId,
  nextPaymentId,
  nextPurchaseId,
  canHardDeletePurchase,
  canVoidPurchase,
  summarize,
  todayIso,
  type NewPayment,
  type NewPurchase,
  type Purchase,
  type WeighingInput,
} from '@/features/pembelian/pembelian-data'
import { pembelianRepository } from '@/features/pembelian/pembelian-storage'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import {
  getPaymentTermDays,
  getPurchasePrefix,
  readAppSettings,
} from '@/features/settings/app-settings'
import { upsertApproval } from '@/features/workflow/approvals'
import { hasProof } from '@/features/workflow/proof'
import type { UserRole } from '@/types/auth'

export type PembelianSection = 'pencatatan' | 'penerimaan' | 'pembayaran'

export const PEMBELIAN_BASE = '/app/pembelian'

const GRAIN_SKU: Record<string, { sku: string; name: string }> = {
  GKP: { sku: 'GBH-IR64', name: 'Gabah IR64 (GKP)' },
  GKG: { sku: 'GBH-CIHERANG', name: 'Gabah Ciherang (GKG)' },
}

function roleAllowed(role: UserRole | undefined, allowed: UserRole[]): boolean {
  if (!role) return false
  return allowed.includes(role)
}

type PembelianContextValue = {
  purchases: Purchase[]
  createPurchase: (data: NewPurchase) => string
  deletePurchase: (id: string) => void
  voidPurchase: (id: string, reason: string) => string | undefined
  submitPurchase: (id: string) => string | undefined
  approvePurchase: (id: string) => string | undefined
  rejectPurchase: (id: string, reason: string) => string | undefined
  completePurchase: (id: string) => string | undefined
  saveWeighing: (id: string, input: WeighingInput) => string | undefined
  confirmWeighing: (id: string, input: WeighingInput) => string | undefined
  addPayment: (id: string, payment: NewPayment) => string | undefined
  updatePurchaseProofs: (
    id: string,
    proofs: {
      invoiceProof?: Purchase['invoiceProof']
      purchaseProof?: Purchase['purchaseProof']
    },
  ) => void
}

const PembelianContext = createContext<PembelianContextValue | null>(null)

export function PembelianProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    upsertPayableFromPurchase,
    applyPurchasePayment,
    removeLinkedPayable,
  } = useFinanceStore()
  const { addMovement } = usePersediaanStore()
  const { appendAudit } = useAuditStore()
  const [items, setItems] = useState<Purchase[]>(
    () => pembelianRepository.load().purchases,
  )

  useEffect(() => {
    pembelianRepository.save({
      version: 1,
      purchases: items,
      updatedAt: new Date().toISOString(),
    })
  }, [items])

  const purchases = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
      ),
    [items],
  )

  const patch = useCallback((id: string, fn: (p: Purchase) => Partial<Purchase>) => {
    setItems((list) => list.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)))
  }, [])

  const createPurchase = useCallback(
    (data: NewPurchase) => {
      const id = nextPurchaseId(
        items,
        new Date(`${data.date}T00:00:00`),
        getPurchasePrefix(),
      )
      setItems((list) => [{ ...data, id, stage: 'draft', payments: [] }, ...list])
      return id
    },
    [items],
  )

  const updatePurchaseProofs = useCallback(
    (
      id: string,
      proofs: {
        invoiceProof?: Purchase['invoiceProof']
        purchaseProof?: Purchase['purchaseProof']
      },
    ) => {
      patch(id, (p) => ({
        invoiceProof: proofs.invoiceProof ?? p.invoiceProof,
        purchaseProof: proofs.purchaseProof ?? p.purchaseProof,
      }))
    },
    [patch],
  )

  const deletePurchase = useCallback((id: string) => {
    setItems((list) => {
      const target = list.find((p) => p.id === id)
      if (!target || !canHardDeletePurchase(target.stage) || target.voidedAt)
        return list
      appendAudit({
        action: 'delete',
        entity: 'purchase',
        entityId: id,
        before: target,
      })
      return list.filter((p) => p.id !== id)
    })
  }, [appendAudit])

  const voidPurchase = useCallback(
    (id: string, reason: string): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat membatalkan pembelian.'
      }
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.voidedAt) return 'Dokumen sudah dibatalkan.'
      if (!canVoidPurchase(current.stage)) {
        return 'Pembelian pada tahap ini tidak dapat dibatalkan.'
      }
      const calc = current.weighing
        ? calcWeighing(current.grain, current.weighing)
        : null
      const map = GRAIN_SKU[current.grain] ?? GRAIN_SKU.GKP
      const location = readAppSettings().stock.defaultLocation
      if (calc && calc.netto > 0) {
        addMovement({
          type: 'out',
          sku: map.sku,
          productName: map.name,
          unit: 'kg',
          qty: calc.netto,
          fromLocation: location,
          toLocation: '—',
          note: `Void penerimaan ${id}`,
        })
      }
      removeLinkedPayable(id)
      setItems((list) =>
        list.map((p) =>
          p.id === id
            ? {
                ...p,
                voidedAt: new Date().toISOString(),
                voidReason: reason || 'Dibatalkan',
              }
            : p,
        ),
      )
      appendAudit({
        action: 'void',
        entity: 'purchase',
        entityId: id,
        note: reason,
      })
      return undefined
    },
    [items, addMovement, removeLinkedPayable, appendAudit, user?.role],
  )

  const submitPurchase = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['pembelian', 'admin'])) {
        return 'Hanya petugas pembelian atau admin yang dapat mengajukan.'
      }
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.voidedAt) return 'Dokumen sudah dibatalkan.'
      if (current.stage !== 'draft') {
        return 'Hanya draft yang dapat diajukan ke keuangan.'
      }
      if (!hasProof(current.invoiceProof)) {
        return 'Lampirkan invoice pemasok sebelum mengajukan ke keuangan.'
      }
      const at = new Date().toISOString()
      patch(id, () => ({ stage: 'diajukan' }))
      appendAudit({
        action: 'submit',
        entity: 'purchase',
        entityId: id,
        note: at,
      })
      return undefined
    },
    [items, patch, appendAudit, user?.role],
  )

  const approvePurchase = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat menyetujui anggaran.'
      }
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.stage !== 'diajukan') {
        return 'Hanya pengajuan menunggu approve yang dapat disetujui.'
      }
      const role = user!.role
      if (role !== 'keuangan' && role !== 'admin') {
        return 'Peran tidak diizinkan menyetujui anggaran.'
      }
      const at = new Date().toISOString()
      const stamp = {
        role,
        by: user!.name,
        at,
      }
      patch(id, (p) => ({
        stage: 'disetujui',
        budgetApprovedAt: at,
        rejectReason: undefined,
        approvals: upsertApproval(p.approvals, stamp),
      }))
      appendAudit({
        action: 'approve',
        entity: 'purchase',
        entityId: id,
        note: `Anggaran disetujui (${role})`,
      })
      return undefined
    },
    [items, patch, appendAudit, user],
  )

  const rejectPurchase = useCallback(
    (id: string, reason: string): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat menolak pengajuan.'
      }
      const trimmed = reason.trim()
      if (!trimmed) return 'Alasan penolakan wajib diisi.'
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.stage !== 'diajukan') {
        return 'Hanya pengajuan menunggu approve yang dapat ditolak.'
      }
      patch(id, () => ({
        stage: 'ditolak',
        rejectReason: trimmed,
      }))
      appendAudit({
        action: 'reject',
        entity: 'purchase',
        entityId: id,
        note: trimmed,
      })
      return undefined
    },
    [items, patch, appendAudit, user?.role],
  )

  const completePurchase = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat menyelesaikan pembelian.'
      }
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.stage !== 'menunggu_selesai') {
        return 'Pembelian belum siap diselesaikan (harus menunggu selesai).'
      }
      if (!hasProof(current.purchaseProof)) {
        return 'Lampirkan struk beli sebelum menyelesaikan pembelian.'
      }
      const at = new Date().toISOString()
      patch(id, () => ({ stage: 'selesai', completedAt: at }))
      appendAudit({
        action: 'update',
        entity: 'purchase',
        entityId: id,
        note: `Selesai · ${at}`,
      })
      return undefined
    },
    [items, patch, appendAudit, user?.role],
  )

  const saveWeighing = useCallback(
    (id: string, input: WeighingInput): string | undefined => {
      if (!roleAllowed(user?.role, ['pembelian', 'admin'])) {
        return 'Hanya petugas pembelian atau admin yang dapat menimbang.'
      }
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.stage !== 'disetujui' && current.stage !== 'ditimbang') {
        return 'Timbang hanya setelah anggaran disetujui keuangan.'
      }
      const { receiptName, ...measures } = input
      patch(id, (p) => ({
        stage: 'ditimbang',
        weighing: {
          ...measures,
          weighedAt: p.weighing?.weighedAt ?? todayIso(),
          receiptName: receiptName ?? p.weighing?.receiptName,
        },
      }))
      return undefined
    },
    [items, patch, user?.role],
  )

  const confirmWeighing = useCallback(
    (id: string, input: WeighingInput): string | undefined => {
      if (!roleAllowed(user?.role, ['pembelian', 'admin'])) {
        return 'Hanya petugas pembelian atau admin yang dapat mengonfirmasi timbang.'
      }
      const today = todayIso()
      const termDays = getPaymentTermDays()
      const dueDate = addDays(today, termDays)
      const { receiptName, ...measures } = input

      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.stage !== 'ditimbang') {
        return 'Simpan hasil timbang terlebih dahulu sebelum konfirmasi.'
      }

      const weighing = {
        ...measures,
        weighedAt: current.weighing?.weighedAt ?? today,
        confirmedAt: today,
        receiptName: receiptName ?? current.weighing?.receiptName,
      }
      const unitPrice = effectiveUnitPrice(
        current.grain,
        current.price,
        weighing.moisture,
      )
      const lotId = current.lotId ?? nextLotId(items, new Date(`${today}T00:00:00`))
      const next: Purchase = {
        ...current,
        stage: 'menunggu_selesai',
        weighing,
        dueDate,
        effectivePrice: unitPrice,
        lotId,
      }
      const summary = summarize(next)
      const supplier = getSupplier(next.supplierId)
      const calc = calcWeighing(next.grain, weighing)
      const map = GRAIN_SKU[next.grain] ?? GRAIN_SKU.GKP
      const location = readAppSettings().stock.defaultLocation

      setItems((list) => list.map((p) => (p.id === id ? next : p)))

      upsertPayableFromPurchase({
        sourceId: next.id,
        supplier: supplier?.name ?? next.supplierId,
        invoice: next.id,
        dueDateIso: dueDate,
        amount: summary.total,
        paid: summary.paid,
      })

      if (calc.netto > 0) {
        addMovement({
          type: 'in',
          sku: map.sku,
          productName: map.name,
          unit: 'kg',
          qty: calc.netto,
          fromLocation: 'Pemasok',
          toLocation: location,
          note: `Penerimaan ${next.id} · lot ${lotId} · ${next.grain}`,
          receiptName: weighing.receiptName,
        })
      }
      appendAudit({
        action: 'post',
        entity: 'purchase',
        entityId: id,
        note: `Lot ${lotId} · harga efektif ${unitPrice}`,
      })
      return undefined
    },
    [addMovement, items, upsertPayableFromPurchase, appendAudit, user?.role],
  )

  const addPayment = useCallback(
    (id: string, payment: NewPayment): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat mencatat pembayaran.'
      }
      if (!hasProof(payment.transferProof) && !hasProof(payment.receiptName)) {
        return 'Lampirkan bukti transfer sebelum mencatat pembayaran.'
      }
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.voidedAt) return 'Dokumen sudah dibatalkan.'
      if (current.stage !== 'menunggu_selesai' && current.stage !== 'selesai') {
        return 'Pembayaran hanya setelah penerimaan dikonfirmasi.'
      }
      const payId = nextPaymentId(items)
      const receiptName =
        payment.receiptName ??
        (typeof payment.transferProof === 'string'
          ? payment.transferProof
          : payment.transferProof?.name)
      const next: Purchase = {
        ...current,
        payments: [
          ...current.payments,
          { ...payment, id: payId, receiptName },
        ],
      }
      const supplier = getSupplier(next.supplierId)

      setItems((list) => list.map((p) => (p.id === id ? next : p)))
      applyPurchasePayment({
        sourceId: next.id,
        amount: payment.amount,
        party: supplier?.name ?? next.supplierId,
        invoice: next.id,
        receiptName,
        note: payment.method,
      })
      return undefined
    },
    [applyPurchasePayment, items, user?.role],
  )

  const value = useMemo(
    () => ({
      purchases,
      createPurchase,
      deletePurchase,
      voidPurchase,
      submitPurchase,
      approvePurchase,
      rejectPurchase,
      completePurchase,
      saveWeighing,
      confirmWeighing,
      addPayment,
      updatePurchaseProofs,
    }),
    [
      purchases,
      createPurchase,
      deletePurchase,
      voidPurchase,
      submitPurchase,
      approvePurchase,
      rejectPurchase,
      completePurchase,
      saveWeighing,
      confirmWeighing,
      addPayment,
      updatePurchaseProofs,
    ],
  )

  return (
    <PembelianContext.Provider value={value}>{children}</PembelianContext.Provider>
  )
}

export function usePembelian(): PembelianContextValue {
  const ctx = useContext(PembelianContext)
  if (!ctx) throw new Error('usePembelian harus dipakai di dalam PembelianProvider')
  return ctx
}

export function useSelectedDoc() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedId = params.get('dok')

  const select = useCallback(
    (id: string | null) => {
      setParams(id ? { dok: id } : {}, { replace: true })
    },
    [setParams],
  )

  const goTo = useCallback(
    (section: PembelianSection, id: string) => {
      const base =
        section === 'pencatatan'
          ? PEMBELIAN_BASE
          : `${PEMBELIAN_BASE}/${section}`
      navigate(`${base}?dok=${encodeURIComponent(id)}`)
    },
    [navigate],
  )

  return { selectedId, select, goTo }
}
