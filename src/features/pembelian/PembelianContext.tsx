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
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuditStore } from '@/features/audit/audit-store'
import { useAuth } from '@/features/auth/AuthContext'
import type { AccountMapKey, JournalLine } from '@/features/keuangan/gl-data'
import type { DualTrackResult } from '@/features/keuangan/dual-track-result'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { assertPeriodOpen } from '@/features/keuangan/period-gate'
import { todayIsoDate } from '@/features/keuangan/period-helpers'
import { computePpn } from '@/features/keuangan/tax-compute'
import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'
import { useTaxStore } from '@/features/keuangan/tax-store'
import {
  addDays,
  calcWeighing,
  effectiveUnitPrice,
  getLotQc,
  getSupplier,
  isPurchaseReceivedForAp,
  nextLotId,
  nextPaymentId,
  nextPurchaseId,
  nextPurchaseReturnId,
  purchaseUnitPrice,
  returnedQtyForPurchase,
  canHardDeletePurchase,
  canVoidPurchase,
  summarize,
  todayIso,
  upsertLotQc as mergeLotQc,
  type LotQc,
  type LotQcGrade,
  type NewPayment,
  type NewPurchase,
  type Purchase,
  type PurchaseReceiveTax,
  type PurchaseReturn,
  type PurchaseReturnLine,
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

export type CreatePurchaseResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

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

const LOT_QC_GRADES: LotQcGrade[] = ['A', 'B', 'C', 'reject']

export type PurchaseReturnInput = {
  /** Set to edit an existing draft or ditolak return. */
  id?: string
  purchaseId: string
  lines: PurchaseReturnLine[]
  reason: string
}

export type LotQcInput = Pick<
  LotQc,
  | 'lotId'
  | 'purchaseId'
  | 'moisture'
  | 'impurity'
  | 'brokenPct'
  | 'grade'
  | 'passed'
  | 'note'
>

function grainSku(grain: string): { sku: string; name: string } {
  return GRAIN_SKU[grain] ?? GRAIN_SKU.GKP
}

function receivedQtyForSku(purchase: Purchase, sku: string): number {
  if (sku !== grainSku(purchase.grain).sku) return 0
  if (!purchase.weighing || !isPurchaseReceivedForAp(purchase.stage)) return 0
  return calcWeighing(purchase.grain, purchase.weighing).netto
}

function normalizeReturnLines(lines: PurchaseReturnLine[]): PurchaseReturnLine[] {
  return lines.map((line) => ({
    sku: line.sku.trim(),
    productName: line.productName.trim(),
    unit: line.unit.trim() || 'kg',
    qty: line.qty,
  }))
}

function returnQtyError(
  purchase: Purchase,
  lines: PurchaseReturnLine[],
  allReturns: PurchaseReturn[],
): string | undefined {
  if (lines.length === 0) return 'Retur wajib punya minimal satu baris.'
  const totals = new Map<string, number>()
  for (const line of lines) {
    if (!line.sku) return 'SKU baris retur wajib diisi.'
    if (!line.productName) return 'Nama barang baris retur wajib diisi.'
    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      return 'Qty retur harus lebih dari 0.'
    }
    totals.set(line.sku, (totals.get(line.sku) ?? 0) + line.qty)
  }
  for (const [sku, qty] of totals) {
    const received = receivedQtyForSku(purchase, sku)
    const returned = returnedQtyForPurchase(allReturns, purchase.id, sku)
    const remaining = received - returned
    if (qty > remaining) {
      return `Qty ${sku} melebihi sisa diterima (${Math.max(0, remaining)} kg).`
    }
  }
  return undefined
}

/** YYYY-MM-DD from ISO or date-only string. */
function journalDateFromIso(iso: string): string {
  return iso.slice(0, 10)
}

function postPembelianJournal(
  postJournalEntry: ReturnType<typeof useFinanceStore>['postJournalEntry'],
  mapAccount: ReturnType<typeof useFinanceStore>['mapAccount'],
  input: {
    date: string
    memo: string
    sourceKey: string
    amount: number
    debitKey: AccountMapKey
    creditKey: AccountMapKey
  },
): string | undefined {
  const { amount, date, memo, sourceKey, debitKey, creditKey } = input
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  return postJournalEntry({
    date,
    memo,
    sourceKey,
    sourceType: 'auto',
    manual: false,
    lines: [
      {
        accountId: mapAccount(debitKey),
        debit: amount,
        credit: 0,
        memo,
      },
      {
        accountId: mapAccount(creditKey),
        debit: 0,
        credit: amount,
        memo,
      },
    ],
  })
}

function postPembelianReceiveJournal(
  postJournalEntry: ReturnType<typeof useFinanceStore>['postJournalEntry'],
  mapAccount: ReturnType<typeof useFinanceStore>['mapAccount'],
  input: {
    date: string
    memo: string
    sourceKey: string
    dpp: number
    ppn: number
    total: number
  },
): string | undefined {
  const { date, memo, sourceKey, dpp, ppn, total } = input
  if (!Number.isFinite(total) || total <= 0) return undefined
  const lines: JournalLine[] = [
    {
      accountId: mapAccount('inventoryGabah'),
      debit: dpp,
      credit: 0,
      memo,
    },
  ]
  if (ppn > 0) {
    lines.push({
      accountId: mapAccount('ppnIn'),
      debit: ppn,
      credit: 0,
      memo,
    })
  }
  lines.push({
    accountId: mapAccount('ap'),
    debit: 0,
    credit: total,
    memo,
  })
  return postJournalEntry({
    date,
    memo,
    sourceKey,
    sourceType: 'auto',
    manual: false,
    lines,
  })
}

function postPembelianReturnJournal(
  postJournalEntry: ReturnType<typeof useFinanceStore>['postJournalEntry'],
  mapAccount: ReturnType<typeof useFinanceStore>['mapAccount'],
  input: {
    date: string
    memo: string
    sourceKey: string
    dpp: number
    ppn: number
    total: number
  },
): string | undefined {
  const { date, memo, sourceKey, dpp, ppn, total } = input
  if (!Number.isFinite(total) || total <= 0) return undefined
  const lines: JournalLine[] = [
    {
      accountId: mapAccount('ap'),
      debit: total,
      credit: 0,
      memo,
    },
    {
      accountId: mapAccount('inventoryGabah'),
      debit: 0,
      credit: dpp,
      memo,
    },
  ]
  if (ppn > 0) {
    lines.push({
      accountId: mapAccount('ppnIn'),
      debit: 0,
      credit: ppn,
      memo,
    })
  }
  return postJournalEntry({
    date,
    memo,
    sourceKey,
    sourceType: 'auto',
    manual: false,
    lines,
  })
}

type PembelianContextValue = {
  purchases: Purchase[]
  createPurchase: (data: NewPurchase) => CreatePurchaseResult
  deletePurchase: (id: string) => void
  voidPurchase: (id: string, reason: string) => string | undefined
  submitPurchase: (id: string) => string | undefined
  approvePurchase: (id: string) => string | undefined
  rejectPurchase: (id: string, reason: string) => string | undefined
  completePurchase: (id: string) => string | undefined
  saveWeighing: (id: string, input: WeighingInput) => string | undefined
  confirmWeighing: (
    id: string,
    input: WeighingInput,
    purchaseProof: Purchase['purchaseProof'] | undefined,
    tax: PurchaseReceiveTax,
  ) => DualTrackResult
  reopenPurchaseDraft: (id: string) => string | undefined
  addPayment: (id: string, payment: NewPayment) => DualTrackResult
  updatePurchaseProofs: (
    id: string,
    proofs: {
      invoiceProof?: Purchase['invoiceProof']
      purchaseProof?: Purchase['purchaseProof']
    },
  ) => void
  returns: PurchaseReturn[]
  lotQc: LotQc[]
  createPurchaseReturn: (input: PurchaseReturnInput) => string | undefined
  submitPurchaseReturn: (id: string) => string | undefined
  approvePurchaseReturn: (id: string) => string | undefined
  rejectPurchaseReturn: (id: string, reason: string) => string | undefined
  postPurchaseReturn: (
    id: string,
    tax: { ppnRate: PpnRate; priceMode: PriceMode },
  ) => DualTrackResult
  upsertLotQc: (input: LotQcInput) => string | undefined
  overrideLotQcReceive: (lotId: string, reason: string) => string | undefined
}

const PembelianContext = createContext<PembelianContextValue | null>(null)

export function PembelianProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    upsertPayableFromPurchase,
    applyPurchasePayment,
    removeLinkedPayable,
    creditPayable,
    postJournalEntry,
    reverseJournalEntry,
    mapAccount,
  } = useFinanceStore()
  const { recordTaxDoc, voidTaxForSource } = useTaxStore()
  const { addMovement } = usePersediaanStore()
  const { appendAudit } = useAuditStore()
  const initialSnapshot = useMemo(() => pembelianRepository.load(), [])
  const [items, setItems] = useState<Purchase[]>(() => initialSnapshot.purchases)
  const [returns, setReturns] = useState<PurchaseReturn[]>(
    () => initialSnapshot.returns,
  )
  const [lotQc, setLotQc] = useState<LotQc[]>(() => initialSnapshot.lotQc)
  const lotQcRef = useRef(lotQc)
  lotQcRef.current = lotQc

  useEffect(() => {
    pembelianRepository.save({
      version: 1,
      purchases: items,
      returns,
      lotQc,
      updatedAt: new Date().toISOString(),
    })
  }, [items, returns, lotQc])

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
    (data: NewPurchase): CreatePurchaseResult => {
      const locked = assertPeriodOpen(data.date)
      if (locked) return { ok: false, error: locked }
      const id = nextPurchaseId(
        items,
        new Date(`${data.date}T00:00:00`),
        getPurchasePrefix(),
      )
      setItems((list) => [{ ...data, id, stage: 'draft', payments: [] }, ...list])
      return { ok: true, id }
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
      if (returns.some((r) => r.purchaseId === id && r.stage === 'posted')) {
        return 'Void ditolak: masih ada retur posted. Void/batalkan retur dulu.'
      }
      const locked = assertPeriodOpen(todayIsoDate())
      if (locked) return locked
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
      reverseJournalEntry({ sourceKey: `po:${id}:receive` })
      voidTaxForSource('purchase', id)
      for (const payment of current.payments) {
        reverseJournalEntry({ sourceKey: `po:${id}:pay:${payment.id}` })
      }
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
    [
      items,
      returns,
      addMovement,
      removeLinkedPayable,
      reverseJournalEntry,
      voidTaxForSource,
      appendAudit,
      user?.role,
    ],
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
      const today = todayIso()
      const lotId =
        current.lotId ?? nextLotId(items, new Date(`${today}T00:00:00`))
      patch(id, (p) => ({
        stage: 'ditimbang',
        lotId: p.lotId ?? lotId,
        weighing: {
          ...measures,
          weighedAt: p.weighing?.weighedAt ?? today,
          receiptName: receiptName ?? p.weighing?.receiptName,
        },
      }))
      return undefined
    },
    [items, patch, user?.role],
  )

  const reopenPurchaseDraft = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['pembelian', 'admin'])) {
        return 'Hanya petugas pembelian atau admin yang dapat mengedit ulang.'
      }
      const current = items.find((p) => p.id === id)
      if (!current) return 'Dokumen pembelian tidak ditemukan.'
      if (current.stage !== 'ditolak') {
        return 'Hanya pengajuan ditolak yang dapat diedit ulang.'
      }
      patch(id, () => ({ stage: 'draft', rejectReason: undefined }))
      appendAudit({
        action: 'update',
        entity: 'purchase',
        entityId: id,
        note: 'Kembali ke draft setelah ditolak',
      })
      return undefined
    },
    [items, patch, appendAudit, user?.role],
  )

  const confirmWeighing = useCallback(
    (
      id: string,
      input: WeighingInput,
      purchaseProof: Purchase['purchaseProof'] | undefined,
      tax: PurchaseReceiveTax,
    ): DualTrackResult => {
      if (!roleAllowed(user?.role, ['pembelian', 'admin'])) {
        return {
          ok: false,
          error:
            'Hanya petugas pembelian atau admin yang dapat mengonfirmasi timbang.',
        }
      }
      const today = todayIso()
      const locked = assertPeriodOpen(today)
      if (locked) return { ok: false, error: locked }
      const termDays = getPaymentTermDays()
      const dueDate = addDays(today, termDays)
      const { receiptName, ...measures } = input

      const current = items.find((p) => p.id === id)
      if (!current) {
        return { ok: false, error: 'Dokumen pembelian tidak ditemukan.' }
      }
      if (current.stage !== 'ditimbang') {
        return {
          ok: false,
          error: 'Simpan hasil timbang terlebih dahulu sebelum konfirmasi.',
        }
      }
      const proof = purchaseProof ?? current.purchaseProof
      if (!hasProof(proof)) {
        return {
          ok: false,
          error: 'Lampirkan struk beli sebelum konfirmasi penerimaan.',
        }
      }
      const lotId = current.lotId ?? nextLotId(items, new Date(`${today}T00:00:00`))
      const qc = getLotQc(lotQcRef.current, lotId)
      if (!qc) return { ok: false, error: 'QC lot belum diisi.' }
      if (!qc.passed && !qc.overrideReason) {
        return {
          ok: false,
          error: 'QC lot belum lulus — perlu override admin.',
        }
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
      const calc = calcWeighing(current.grain, weighing)
      const subtotal = calc.netto * unitPrice
      const taxCalc = computePpn({
        subtotal,
        rate: tax.ppnRate,
        priceMode: tax.priceMode,
      })
      const supplierFakturNo = tax.supplierFakturNo?.trim() || undefined
      const next: Purchase = {
        ...current,
        stage: 'menunggu_selesai',
        weighing,
        dueDate,
        effectivePrice: unitPrice,
        lotId,
        purchaseProof: proof,
        ppnRate: tax.ppnRate,
        priceMode: tax.priceMode,
        dpp: taxCalc.dpp,
        ppn: taxCalc.ppn,
        totalWithTax: taxCalc.total,
      }
      const summary = summarize(next)
      const supplier = getSupplier(next.supplierId)
      const party = supplier?.name ?? next.supplierId
      const map = GRAIN_SKU[next.grain] ?? GRAIN_SKU.GKP
      const location = readAppSettings().stock.defaultLocation

      setItems((list) => list.map((p) => (p.id === id ? next : p)))

      upsertPayableFromPurchase({
        sourceId: next.id,
        supplier: party,
        invoice: next.id,
        dueDateIso: dueDate,
        amount: taxCalc.total,
        paid: summary.paid,
      })

      recordTaxDoc({
        sourceType: 'purchase',
        sourceId: next.id,
        date: today,
        ppnRate: tax.ppnRate,
        priceMode: tax.priceMode,
        dpp: taxCalc.dpp,
        ppn: taxCalc.ppn,
        total: taxCalc.total,
        partyName: party,
        supplierFakturNo,
      })

      const journalError = postPembelianReceiveJournal(
        postJournalEntry,
        mapAccount,
        {
          date: today,
          memo: `Penerimaan gabah ${next.id}`,
          sourceKey: `po:${next.id}:receive`,
          dpp: taxCalc.dpp,
          ppn: taxCalc.ppn,
          total: taxCalc.total,
        },
      )

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
      return journalError ? { ok: true, journalError } : { ok: true }
    },
    [
      addMovement,
      items,
      upsertPayableFromPurchase,
      postJournalEntry,
      mapAccount,
      appendAudit,
      recordTaxDoc,
      user?.role,
    ],
  )

  const addPayment = useCallback(
    (id: string, payment: NewPayment): DualTrackResult => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return {
          ok: false,
          error: 'Hanya keuangan atau admin yang dapat mencatat pembayaran.',
        }
      }
      if (!hasProof(payment.transferProof) && !hasProof(payment.receiptName)) {
        return {
          ok: false,
          error: 'Lampirkan bukti transfer sebelum mencatat pembayaran.',
        }
      }
      const current = items.find((p) => p.id === id)
      if (!current) {
        return { ok: false, error: 'Dokumen pembelian tidak ditemukan.' }
      }
      if (current.voidedAt) {
        return { ok: false, error: 'Dokumen sudah dibatalkan.' }
      }
      if (current.stage !== 'menunggu_selesai' && current.stage !== 'selesai') {
        return {
          ok: false,
          error: 'Pembayaran hanya setelah penerimaan dikonfirmasi.',
        }
      }
      const payDate = journalDateFromIso(payment.date)
      const locked = assertPeriodOpen(payDate)
      if (locked) return { ok: false, error: locked }
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

      const journalError = postPembelianJournal(postJournalEntry, mapAccount, {
        date: journalDateFromIso(payment.date),
        memo: `Bayar utang ${next.id} · ${payId}`,
        sourceKey: `po:${next.id}:pay:${payId}`,
        amount: payment.amount,
        debitKey: 'ap',
        creditKey: 'cash',
      })
      return journalError ? { ok: true, journalError } : { ok: true }
    },
    [applyPurchasePayment, postJournalEntry, mapAccount, items, user?.role],
  )

  const createPurchaseReturn = useCallback(
    (input: PurchaseReturnInput): string | undefined => {
      if (!roleAllowed(user?.role, ['pembelian', 'admin'])) {
        return 'Hanya petugas pembelian atau admin yang dapat mencatat retur.'
      }
      const reason = input.reason.trim()
      if (!reason) return 'Alasan retur wajib diisi.'
      const purchase = items.find((p) => p.id === input.purchaseId)
      if (!purchase) return 'Dokumen pembelian tidak ditemukan.'
      if (purchase.voidedAt) return 'Dokumen pembelian sudah dibatalkan.'
      if (!isPurchaseReceivedForAp(purchase.stage)) {
        return 'Retur hanya untuk pembelian yang sudah diterima.'
      }
      const lines = normalizeReturnLines(input.lines)
      const qtyError = returnQtyError(purchase, lines, returns)
      if (qtyError) return qtyError

      if (input.id) {
        const existing = returns.find((r) => r.id === input.id)
        if (!existing) return 'Dokumen retur tidak ditemukan.'
        if (existing.stage !== 'draft' && existing.stage !== 'ditolak') {
          return 'Hanya retur draft atau ditolak yang dapat diubah.'
        }
        setReturns((list) =>
          list.map((r) =>
            r.id === input.id
              ? {
                  ...r,
                  purchaseId: purchase.id,
                  lotId: purchase.lotId,
                  lines,
                  reason,
                  stage: 'draft',
                  rejectedReason: undefined,
                  approvals: undefined,
                }
              : r,
          ),
        )
        appendAudit({
          action: 'update',
          entity: 'purchase',
          entityId: input.id,
          note: `Ubah retur ${purchase.id}`,
        })
        return undefined
      }

      const id = nextPurchaseReturnId(returns)
      const row: PurchaseReturn = {
        id,
        purchaseId: purchase.id,
        lotId: purchase.lotId,
        lines,
        reason,
        stage: 'draft',
        createdAt: new Date().toISOString(),
      }
      setReturns((list) => [row, ...list])
      appendAudit({
        action: 'create',
        entity: 'purchase',
        entityId: id,
        note: `Retur ${purchase.id}`,
      })
      return undefined
    },
    [items, returns, appendAudit, user?.role],
  )

  const submitPurchaseReturn = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['pembelian', 'admin'])) {
        return 'Hanya petugas pembelian atau admin yang dapat mengajukan retur.'
      }
      const current = returns.find((r) => r.id === id)
      if (!current) return 'Dokumen retur tidak ditemukan.'
      if (current.stage !== 'draft') {
        return 'Hanya draft yang dapat diajukan.'
      }
      const purchase = items.find((p) => p.id === current.purchaseId)
      if (!purchase) return 'Dokumen pembelian tidak ditemukan.'
      if (purchase.voidedAt) return 'Dokumen pembelian sudah dibatalkan.'
      const qtyError = returnQtyError(purchase, current.lines, returns)
      if (qtyError) return qtyError
      setReturns((list) =>
        list.map((r) => (r.id === id ? { ...r, stage: 'diajukan' } : r)),
      )
      appendAudit({
        action: 'submit',
        entity: 'purchase',
        entityId: id,
        note: `Ajukan retur ${current.purchaseId}`,
      })
      return undefined
    },
    [items, returns, appendAudit, user?.role],
  )

  const approvePurchaseReturn = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat menyetujui retur.'
      }
      const current = returns.find((r) => r.id === id)
      if (!current) return 'Dokumen retur tidak ditemukan.'
      if (current.stage !== 'diajukan') {
        return 'Hanya retur diajukan yang dapat disetujui.'
      }
      const role = user!.role
      if (role !== 'keuangan' && role !== 'admin') {
        return 'Peran tidak diizinkan menyetujui retur.'
      }
      const at = new Date().toISOString()
      setReturns((list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                stage: 'disetujui',
                rejectedReason: undefined,
                approvals: upsertApproval(r.approvals, {
                  role,
                  by: user!.name,
                  at,
                }),
              }
            : r,
        ),
      )
      appendAudit({
        action: 'approve',
        entity: 'purchase',
        entityId: id,
        note: `Retur disetujui (${role})`,
      })
      return undefined
    },
    [returns, appendAudit, user],
  )

  const rejectPurchaseReturn = useCallback(
    (id: string, reason: string): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat menolak retur.'
      }
      const trimmed = reason.trim()
      if (!trimmed) return 'Alasan penolakan wajib diisi.'
      const current = returns.find((r) => r.id === id)
      if (!current) return 'Dokumen retur tidak ditemukan.'
      if (current.stage !== 'diajukan') {
        return 'Hanya retur diajukan yang dapat ditolak.'
      }
      setReturns((list) =>
        list.map((r) =>
          r.id === id
            ? { ...r, stage: 'ditolak', rejectedReason: trimmed }
            : r,
        ),
      )
      appendAudit({
        action: 'reject',
        entity: 'purchase',
        entityId: id,
        note: trimmed,
      })
      return undefined
    },
    [returns, appendAudit, user?.role],
  )

  const postPurchaseReturn = useCallback(
    (
      id: string,
      tax: { ppnRate: PpnRate; priceMode: PriceMode },
    ): DualTrackResult => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return {
          ok: false,
          error: 'Hanya keuangan atau admin yang dapat memposting retur.',
        }
      }
      const current = returns.find((r) => r.id === id)
      if (!current) {
        return { ok: false, error: 'Dokumen retur tidak ditemukan.' }
      }
      if (current.stage !== 'disetujui') {
        return { ok: false, error: 'Hanya retur disetujui yang dapat diposting.' }
      }
      const purchase = items.find((p) => p.id === current.purchaseId)
      if (!purchase) {
        return { ok: false, error: 'Dokumen pembelian tidak ditemukan.' }
      }
      if (purchase.voidedAt) {
        return { ok: false, error: 'Dokumen pembelian sudah dibatalkan.' }
      }
      const qtyError = returnQtyError(purchase, current.lines, returns)
      if (qtyError) return { ok: false, error: qtyError }

      const postDate = todayIsoDate()
      const locked = assertPeriodOpen(postDate)
      if (locked) return { ok: false, error: locked }

      const unitPrice = purchaseUnitPrice(purchase)
      const subtotal = current.lines.reduce(
        (sum, line) => sum + line.qty * unitPrice,
        0,
      )
      const taxCalc = computePpn({
        subtotal,
        rate: tax.ppnRate,
        priceMode: tax.priceMode,
      })
      const location = readAppSettings().stock.defaultLocation
      const supplier = getSupplier(purchase.supplierId)
      const party = supplier?.name ?? purchase.supplierId
      const postedAt = new Date().toISOString()
      const taxDocDate = journalDateFromIso(postedAt)

      for (const line of current.lines) {
        addMovement({
          type: 'out',
          sku: line.sku,
          productName: line.productName,
          unit: line.unit,
          qty: line.qty,
          fromLocation: location,
          toLocation: 'Pemasok',
          note: `Retur pembelian ${current.id} · ${purchase.id}`,
        })
      }
      creditPayable(purchase.id, taxCalc.total)
      recordTaxDoc({
        sourceType: 'purchaseReturn',
        sourceId: current.id,
        date: taxDocDate,
        ppnRate: tax.ppnRate,
        priceMode: tax.priceMode,
        dpp: taxCalc.dpp,
        ppn: taxCalc.ppn,
        total: taxCalc.total,
        partyName: party,
      })

      const journalError = postPembelianReturnJournal(
        postJournalEntry,
        mapAccount,
        {
          date: taxDocDate,
          memo: `Retur pembelian ${current.id} · ${purchase.id}`,
          sourceKey: `pr:${current.id}:post`,
          dpp: taxCalc.dpp,
          ppn: taxCalc.ppn,
          total: taxCalc.total,
        },
      )

      setReturns((list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                stage: 'posted',
                postedAt,
                ppnRate: tax.ppnRate,
                priceMode: tax.priceMode,
                dpp: taxCalc.dpp,
                ppn: taxCalc.ppn,
                totalWithTax: taxCalc.total,
              }
            : r,
        ),
      )
      appendAudit({
        action: 'return',
        entity: 'purchase',
        entityId: current.id,
        note: `Retur ${purchase.id}`,
      })
      return journalError ? { ok: true, journalError } : { ok: true }
    },
    [
      items,
      returns,
      addMovement,
      creditPayable,
      postJournalEntry,
      mapAccount,
      appendAudit,
      recordTaxDoc,
      user?.role,
    ],
  )

  const upsertLotQc = useCallback(
    (input: LotQcInput): string | undefined => {
      if (!roleAllowed(user?.role, ['pembelian', 'gudang', 'admin'])) {
        return 'Hanya pembelian, gudang, atau admin yang dapat mengisi QC lot.'
      }
      const lotId = input.lotId.trim()
      if (!lotId) return 'Lot wajib diisi.'
      if (!LOT_QC_GRADES.includes(input.grade)) return 'Grade QC tidak valid.'
      if (
        !Number.isFinite(input.moisture) ||
        input.moisture < 0 ||
        !Number.isFinite(input.impurity) ||
        input.impurity < 0 ||
        !Number.isFinite(input.brokenPct) ||
        input.brokenPct < 0
      ) {
        return 'Angka QC tidak valid.'
      }
      const purchase = items.find((p) => p.lotId === lotId)
      if (!purchase) return 'Lot tidak ditemukan pada pembelian.'
      if (input.purchaseId !== purchase.id) {
        return 'Lot tidak sesuai dengan pembelian.'
      }
      const prev = lotQcRef.current.find((q) => q.lotId === lotId)
      const row: LotQc = {
        lotId,
        purchaseId: purchase.id,
        moisture: input.moisture,
        impurity: input.impurity,
        brokenPct: input.brokenPct,
        grade: input.grade,
        passed: input.passed,
        note: input.note?.trim() || undefined,
        by: user?.name ?? 'Sistem',
        at: new Date().toISOString(),
        overrideReason: input.passed ? undefined : prev?.overrideReason,
      }
      const next = mergeLotQc(lotQcRef.current, row)
      lotQcRef.current = next
      setLotQc(next)
      appendAudit({
        action: 'update',
        entity: 'purchase',
        entityId: purchase.id,
        note: `QC ${lotId} · ${input.passed ? 'lulus' : 'tidak lulus'} · grade ${input.grade}`,
      })
      return undefined
    },
    [items, appendAudit, user],
  )

  const overrideLotQcReceive = useCallback(
    (lotId: string, reason: string): string | undefined => {
      if (!roleAllowed(user?.role, ['admin'])) {
        return 'Hanya admin yang dapat mengoverride penerimaan QC.'
      }
      const trimmed = reason.trim()
      if (!trimmed) return 'Alasan override wajib diisi.'
      const current = lotQcRef.current.find((q) => q.lotId === lotId)
      if (!current) return 'QC lot belum diisi.'
      if (current.passed) return 'QC lot sudah lulus.'
      const next = lotQcRef.current.map((q) =>
        q.lotId === lotId ? { ...q, overrideReason: trimmed } : q,
      )
      lotQcRef.current = next
      setLotQc(next)
      appendAudit({
        action: 'update',
        entity: 'purchase',
        entityId: current.purchaseId,
        note: `Override QC ${lotId}: ${trimmed}`,
      })
      return undefined
    },
    [appendAudit, user?.role],
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
      reopenPurchaseDraft,
      addPayment,
      updatePurchaseProofs,
      returns,
      lotQc,
      createPurchaseReturn,
      submitPurchaseReturn,
      approvePurchaseReturn,
      rejectPurchaseReturn,
      postPurchaseReturn,
      upsertLotQc,
      overrideLotQcReceive,
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
      reopenPurchaseDraft,
      addPayment,
      updatePurchaseProofs,
      returns,
      lotQc,
      createPurchaseReturn,
      submitPurchaseReturn,
      approvePurchaseReturn,
      rejectPurchaseReturn,
      postPurchaseReturn,
      upsertLotQc,
      overrideLotQcReceive,
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
