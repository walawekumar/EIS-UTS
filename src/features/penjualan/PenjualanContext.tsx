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
import type { AccountMapKey, JournalLine } from '@/features/keuangan/gl-data'
import type { DualTrackResult } from '@/features/keuangan/dual-track-result'
import { joinJournalErrors } from '@/features/keuangan/dual-track-result'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { computePpn } from '@/features/keuangan/tax-compute'
import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'
import { useTaxStore } from '@/features/keuangan/tax-store'
import { lookupCustomer } from '@/features/master/master-storage'
import { cogsAmountForLot } from '@/features/penjualan/cogs-from-lot'
import { useProduksi } from '@/features/produksi/ProduksiContext'
import {
  addDays,
  getCustomer,
  nextOrderId,
  nextPaymentId,
  nextSaleReturnId,
  returnedQtyForOrder,
  todayIso,
  type DeliveryInput,
  type NewSaleOrder,
  type Payment,
  type SaleOrder,
  type SaleReturn,
  type SaleReturnLine,
} from '@/features/penjualan/penjualan-data'
import { penjualanRepository } from '@/features/penjualan/penjualan-storage'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import {
  getOrderPrefix,
  getPaymentTermDays,
  readAppSettings,
} from '@/features/settings/app-settings'
import { upsertApproval } from '@/features/workflow/approvals'
import type { UserRole } from '@/types/auth'

function roleAllowed(role: UserRole | undefined, allowed: UserRole[]): boolean {
  if (!role) return false
  return allowed.includes(role)
}

/** YYYY-MM-DD from ISO or date-only string. */
function journalDateFromIso(iso: string): string {
  return iso.slice(0, 10)
}

export type PenjualanActionResult = DualTrackResult

function postPenjualanPairJournal(
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

function postPenjualanShipJournal(
  postJournalEntry: ReturnType<typeof useFinanceStore>['postJournalEntry'],
  mapAccount: ReturnType<typeof useFinanceStore>['mapAccount'],
  input: {
    date: string
    memo: string
    sourceKey: string
    dpp: number
    ppn: number
    total: number
    cogsAmount: number
  },
): string | undefined {
  const { date, memo, sourceKey, dpp, ppn, total, cogsAmount } = input
  if (!Number.isFinite(total) || total <= 0) return undefined
  const lines: JournalLine[] = [
    {
      accountId: mapAccount('ar'),
      debit: total,
      credit: 0,
      memo,
    },
    {
      accountId: mapAccount('sales'),
      debit: 0,
      credit: dpp,
      memo,
    },
  ]
  if (ppn > 0) {
    lines.push({
      accountId: mapAccount('ppnOut'),
      debit: 0,
      credit: ppn,
      memo,
    })
  }
  if (Number.isFinite(cogsAmount) && cogsAmount > 0) {
    lines.push(
      {
        accountId: mapAccount('cogs'),
        debit: cogsAmount,
        credit: 0,
        memo,
      },
      {
        accountId: mapAccount('inventoryBeras'),
        debit: 0,
        credit: cogsAmount,
        memo,
      },
    )
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

function postPenjualanReturnJournal(
  postJournalEntry: ReturnType<typeof useFinanceStore>['postJournalEntry'],
  mapAccount: ReturnType<typeof useFinanceStore>['mapAccount'],
  input: {
    date: string
    memo: string
    sourceKey: string
    dpp: number
    ppn: number
    total: number
    cogsAmount: number
  },
): string | undefined {
  const { date, memo, sourceKey, dpp, ppn, total, cogsAmount } = input
  if (!Number.isFinite(total) || total <= 0) return undefined
  const lines: JournalLine[] = [
    {
      accountId: mapAccount('salesReturn'),
      debit: dpp,
      credit: 0,
      memo,
    },
  ]
  if (ppn > 0) {
    lines.push({
      accountId: mapAccount('ppnOut'),
      debit: ppn,
      credit: 0,
      memo,
    })
  }
  lines.push({
    accountId: mapAccount('ar'),
    debit: 0,
    credit: total,
    memo,
  })
  if (Number.isFinite(cogsAmount) && cogsAmount > 0) {
    lines.push(
      {
        accountId: mapAccount('inventoryBeras'),
        debit: cogsAmount,
        credit: 0,
        memo,
      },
      {
        accountId: mapAccount('cogs'),
        debit: 0,
        credit: cogsAmount,
        memo,
      },
    )
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

export type SaleReturnInput = {
  /** Set to edit an existing draft or ditolak return. */
  id?: string
  orderId: string
  lines: SaleReturnLine[]
  reason: string
  ppnRate: PpnRate
  priceMode: PriceMode
}

function normalizeReturnLines(lines: SaleReturnLine[]): SaleReturnLine[] {
  return lines.map((line) => ({
    sku: line.sku.trim(),
    productName: line.productName.trim(),
    unit: line.unit.trim() || 'kg',
    qty: line.qty,
  }))
}

function shippedQtyForSku(order: SaleOrder, sku: string): number {
  if (order.voidedAt || order.stage !== 'dikirim' || order.sku !== sku) return 0
  return order.qty
}

function returnQtyError(
  order: SaleOrder,
  lines: SaleReturnLine[],
  allReturns: SaleReturn[],
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
    const shipped = shippedQtyForSku(order, sku)
    const returned = returnedQtyForOrder(allReturns, order.id, sku)
    const remaining = shipped - returned
    if (qty > remaining) {
      return `Qty ${sku} melebihi sisa dikirim (${Math.max(0, remaining)}).`
    }
  }
  return undefined
}

export type PenjualanSection = 'order' | 'pengiriman' | 'tagihan'

export const PENJUALAN_BASE = '/app/penjualan'

type PenjualanContextValue = {
  orders: SaleOrder[]
  createOrder: (data: NewSaleOrder) => string
  deleteOrder: (id: string) => void
  voidOrder: (id: string, reason: string) => string | undefined
  shipOrder: (id: string, input: DeliveryInput) => PenjualanActionResult
  addPayment: (
    id: string,
    payment: Omit<Payment, 'id'>,
  ) => PenjualanActionResult
  returns: SaleReturn[]
  createSaleReturn: (input: SaleReturnInput) => string | undefined
  submitSaleReturn: (id: string) => string | undefined
  approveSaleReturn: (id: string) => string | undefined
  rejectSaleReturn: (id: string, reason: string) => string | undefined
  postSaleReturn: (
    id: string,
    tax: { ppnRate: PpnRate; priceMode: PriceMode },
  ) => PenjualanActionResult
}

const PenjualanContext = createContext<PenjualanContextValue | null>(null)

export function PenjualanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    upsertReceivableFromSale,
    applySalePayment,
    addCashEntry,
    removeLinkedReceivable,
    creditReceivable,
    postJournalEntry,
    reverseJournalEntry,
    mapAccount,
    receivables,
  } = useFinanceStore()
  const { recordTaxDoc, recordSaleInvoice, voidTaxForSource } = useTaxStore()
  const { addMovement } = usePersediaanStore()
  const { appendAudit } = useAuditStore()
  const { lotCosts } = useProduksi()
  const initialSnapshot = useMemo(() => penjualanRepository.load(), [])
  const [items, setItems] = useState<SaleOrder[]>(() => initialSnapshot.orders)
  const [returns, setReturns] = useState<SaleReturn[]>(() => initialSnapshot.returns)

  useEffect(() => {
    penjualanRepository.save({
      version: 1,
      orders: items,
      returns,
      updatedAt: new Date().toISOString(),
    })
  }, [items, returns])

  const orders = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
      ),
    [items],
  )

  const createOrder = useCallback(
    (data: NewSaleOrder) => {
      const id = nextOrderId(
        items,
        new Date(`${data.date}T00:00:00`),
        getOrderPrefix(),
      )
      setItems((list) => [
        { ...data, id, stage: 'dibuat', payments: [] },
        ...list,
      ])
      return id
    },
    [items],
  )

  const deleteOrder = useCallback(
    (id: string) => {
      setItems((list) => {
        const target = list.find((o) => o.id === id)
        if (!target || target.stage !== 'dibuat' || target.voidedAt) return list
        appendAudit({
          action: 'delete',
          entity: 'sale',
          entityId: id,
          before: target,
        })
        return list.filter((o) => o.id !== id)
      })
    },
    [appendAudit],
  )

  const voidOrder = useCallback(
    (id: string, reason: string): string | undefined => {
      const current = items.find((o) => o.id === id)
      if (!current || current.voidedAt || current.stage !== 'dikirim') {
        return 'Order tidak dapat dibatalkan.'
      }
      if (returns.some((r) => r.orderId === id && r.stage === 'posted')) {
        return 'Void ditolak: masih ada retur posted. Void/batalkan retur dulu.'
      }
      const location = readAppSettings().stock.defaultLocation
      addMovement({
        type: 'in',
        sku: current.sku,
        productName: current.productName,
        unit: current.unit,
        qty: current.qty,
        fromLocation: '—',
        toLocation: location,
        note: `Void pengiriman ${id}`,
      })
      removeLinkedReceivable(id)
      reverseJournalEntry({ sourceKey: `so:${id}:ship` })
      reverseJournalEntry({ sourceKey: `so:${id}:cod` })
      voidTaxForSource('sale', id)
      for (const payment of current.payments) {
        reverseJournalEntry({ sourceKey: `so:${id}:pay:${payment.id}` })
      }
      setItems((list) =>
        list.map((o) =>
          o.id === id
            ? {
                ...o,
                voidedAt: new Date().toISOString(),
                voidReason: reason || 'Dibatalkan',
              }
            : o,
        ),
      )
      appendAudit({
        action: 'void',
        entity: 'sale',
        entityId: id,
        note: reason,
        before: current,
      })
      return undefined
    },
    [
      items,
      returns,
      addMovement,
      removeLinkedReceivable,
      reverseJournalEntry,
      voidTaxForSource,
      appendAudit,
    ],
  )

  const shipOrder = useCallback(
    (id: string, input: DeliveryInput): PenjualanActionResult => {
      const today = todayIso()
      const termDays = getPaymentTermDays()
      const location = readAppSettings().stock.defaultLocation
      const current = items.find((o) => o.id === id)
      if (!current || current.voidedAt) {
        return { ok: false, error: 'Order tidak ditemukan' }
      }

      const cogs = cogsAmountForLot(lotCosts, input.lotId, current.qty)
      if (!cogs.ok) return { ok: false, error: cogs.error }

      const subtotal = current.qty * current.price
      const calc = computePpn({
        subtotal,
        rate: input.ppnRate,
        priceMode: input.priceMode,
      })
      const total = calc.total
      const isPaid = input.settlement === 'lunas'

      if (!isPaid) {
        const partner = lookupCustomer(current.customerId)
        const limit = partner?.creditLimit ?? 0
        if (limit > 0) {
          const openAr = receivables
            .filter(
              (r) =>
                r.customer === (partner?.name ?? current.customerId) &&
                r.paid < r.amount,
            )
            .reduce((s, r) => s + (r.amount - r.paid), 0)
          if (openAr + total > limit) {
            return {
              ok: false,
              error: `Melebihi limit kredit (${limit.toLocaleString('id-ID')}). Outstanding ${openAr.toLocaleString('id-ID')}`,
            }
          }
        }
      }
      const payId = nextPaymentId(items)
      const payments = isPaid
        ? [
            ...current.payments,
            {
              id: payId,
              date: today,
              amount: total,
              method: input.payMethod ?? 'tunai',
              receiptName: input.payReceiptName,
            },
          ]
        : current.payments
      const dueDate = isPaid ? today : addDays(today, termDays)
      const next: SaleOrder = {
        ...current,
        stage: 'dikirim',
        lotId: input.lotId,
        delivery: {
          shippedAt: today,
          vehicle: input.vehicle,
          driver: input.driver,
          note: input.note,
          receiptName: input.receiptName,
          settlement: input.settlement,
          payMethod: input.payMethod,
          payReceiptName: input.payReceiptName,
        },
        dueDate,
        payments,
        ppnRate: input.ppnRate,
        priceMode: input.priceMode,
        dpp: calc.dpp,
        ppn: calc.ppn,
        totalWithTax: calc.total,
      }

      const customer = getCustomer(next.customerId)
      const party = customer?.name ?? next.customerId

      setItems((list) => list.map((o) => (o.id === id ? next : o)))

      upsertReceivableFromSale({
        sourceId: next.id,
        customer: party,
        invoice: next.id,
        dueDateIso: dueDate,
        amount: total,
        paid: isPaid ? total : 0,
      })

      const taxDoc = recordTaxDoc({
        sourceType: 'sale',
        sourceId: next.id,
        date: today,
        ppnRate: input.ppnRate,
        priceMode: input.priceMode,
        dpp: calc.dpp,
        ppn: calc.ppn,
        total: calc.total,
        partyName: party,
      })
      recordSaleInvoice(taxDoc, next.id, party)

      const shipJeErr = postPenjualanShipJournal(postJournalEntry, mapAccount, {
        date: today,
        memo: `Pengiriman penjualan ${next.id} · ${party}`,
        sourceKey: `so:${next.id}:ship`,
        dpp: calc.dpp,
        ppn: calc.ppn,
        total: calc.total,
        cogsAmount: cogs.amount,
      })

      let codJeErr: string | undefined
      if (isPaid) {
        addCashEntry({
          direction: 'in',
          category: 'Penjualan',
          description: `Pelunasan kirim ${next.id} · ${party}`,
          amount: total,
          receiptName: input.payReceiptName,
        })
        codJeErr = postPenjualanPairJournal(postJournalEntry, mapAccount, {
          date: today,
          memo: `Pelunasan COD ${next.id} · ${party}`,
          sourceKey: `so:${next.id}:cod`,
          amount: total,
          debitKey: 'cash',
          creditKey: 'ar',
        })
      }

      addMovement({
        type: 'out',
        sku: next.sku,
        productName: next.productName,
        unit: next.unit,
        qty: next.qty,
        fromLocation: location,
        toLocation: party,
        note: `Pengiriman ${next.id}`,
        receiptName: input.receiptName,
      })
      appendAudit({
        action: 'post',
        entity: 'sale',
        entityId: id,
        note: input.settlement,
      })
      const journalError = joinJournalErrors(shipJeErr, codJeErr)
      return journalError ? { ok: true, journalError } : { ok: true }
    },
    [
      addCashEntry,
      addMovement,
      items,
      lotCosts,
      upsertReceivableFromSale,
      postJournalEntry,
      mapAccount,
      receivables,
      appendAudit,
      recordTaxDoc,
      recordSaleInvoice,
    ],
  )

  const addPayment = useCallback(
    (id: string, payment: Omit<Payment, 'id'>): PenjualanActionResult => {
      const current = items.find((o) => o.id === id)
      if (!current) return { ok: false, error: 'Order tidak ditemukan' }
      const payId = nextPaymentId(items)
      const next: SaleOrder = {
        ...current,
        payments: [...current.payments, { ...payment, id: payId }],
      }
      const customer = getCustomer(next.customerId)

      setItems((list) => list.map((o) => (o.id === id ? next : o)))
      applySalePayment({
        sourceId: next.id,
        amount: payment.amount,
        party: customer?.name ?? next.customerId,
        invoice: next.id,
        receiptName: payment.receiptName,
        note: payment.method,
      })
      const journalError = postPenjualanPairJournal(
        postJournalEntry,
        mapAccount,
        {
          date: journalDateFromIso(payment.date),
          memo: `Terima piutang ${next.id} · ${customer?.name ?? next.customerId}`,
          sourceKey: `so:${next.id}:pay:${payId}`,
          amount: payment.amount,
          debitKey: 'cash',
          creditKey: 'ar',
        },
      )
      return journalError
        ? { ok: true, journalError }
        : { ok: true }
    },
    [applySalePayment, items, postJournalEntry, mapAccount],
  )

  const createSaleReturn = useCallback(
    (input: SaleReturnInput): string | undefined => {
      if (!roleAllowed(user?.role, ['penjualan', 'admin'])) {
        return 'Hanya petugas penjualan atau admin yang dapat mencatat retur.'
      }
      const reason = input.reason.trim()
      if (!reason) return 'Alasan retur wajib diisi.'
      const order = items.find((o) => o.id === input.orderId)
      if (!order) return 'Order penjualan tidak ditemukan.'
      if (order.voidedAt) return 'Order penjualan sudah dibatalkan.'
      if (order.stage !== 'dikirim') {
        return 'Retur hanya untuk order yang sudah dikirim.'
      }
      const lines = normalizeReturnLines(input.lines)
      const qtyError = returnQtyError(order, lines, returns)
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
                  orderId: order.id,
                  lines,
                  reason,
                  ppnRate: input.ppnRate,
                  priceMode: input.priceMode,
                  stage: 'draft',
                  rejectedReason: undefined,
                  approvals: undefined,
                }
              : r,
          ),
        )
        appendAudit({
          action: 'update',
          entity: 'sale',
          entityId: input.id,
          note: `Ubah retur ${order.id}`,
        })
        return undefined
      }

      const id = nextSaleReturnId(returns)
      const row: SaleReturn = {
        id,
        orderId: order.id,
        lines,
        reason,
        ppnRate: input.ppnRate,
        priceMode: input.priceMode,
        stage: 'draft',
        createdAt: new Date().toISOString(),
      }
      setReturns((list) => [row, ...list])
      appendAudit({
        action: 'create',
        entity: 'sale',
        entityId: id,
        note: `Retur ${order.id}`,
      })
      return undefined
    },
    [items, returns, appendAudit, user?.role],
  )

  const submitSaleReturn = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['penjualan', 'admin'])) {
        return 'Hanya petugas penjualan atau admin yang dapat mengajukan retur.'
      }
      const current = returns.find((r) => r.id === id)
      if (!current) return 'Dokumen retur tidak ditemukan.'
      if (current.stage !== 'draft') {
        return 'Hanya draft yang dapat diajukan.'
      }
      const order = items.find((o) => o.id === current.orderId)
      if (!order) return 'Order penjualan tidak ditemukan.'
      if (order.voidedAt) return 'Order penjualan sudah dibatalkan.'
      const qtyError = returnQtyError(order, current.lines, returns)
      if (qtyError) return qtyError
      setReturns((list) =>
        list.map((r) => (r.id === id ? { ...r, stage: 'diajukan' } : r)),
      )
      appendAudit({
        action: 'submit',
        entity: 'sale',
        entityId: id,
        note: `Ajukan retur ${current.orderId}`,
      })
      return undefined
    },
    [items, returns, appendAudit, user?.role],
  )

  const approveSaleReturn = useCallback(
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
        entity: 'sale',
        entityId: id,
        note: `Retur disetujui (${role})`,
      })
      return undefined
    },
    [returns, appendAudit, user],
  )

  const rejectSaleReturn = useCallback(
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
        entity: 'sale',
        entityId: id,
        note: trimmed,
      })
      return undefined
    },
    [returns, appendAudit, user?.role],
  )

  const postSaleReturn = useCallback(
    (
      id: string,
      tax: { ppnRate: PpnRate; priceMode: PriceMode },
    ): PenjualanActionResult => {
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
      const order = items.find((o) => o.id === current.orderId)
      if (!order) {
        return { ok: false, error: 'Order penjualan tidak ditemukan.' }
      }
      if (order.voidedAt) {
        return { ok: false, error: 'Order penjualan sudah dibatalkan.' }
      }
      const qtyError = returnQtyError(order, current.lines, returns)
      if (qtyError) return { ok: false, error: qtyError }

      if (!order.lotId) {
        return {
          ok: false,
          error:
            'Order belum punya lot costing; tidak bisa post retur dengan COGS LotCost.',
        }
      }
      const retQty = current.lines.reduce((s, l) => s + l.qty, 0)
      const cogs = cogsAmountForLot(lotCosts, order.lotId, retQty)
      if (!cogs.ok) return { ok: false, error: cogs.error }

      const subtotal = current.lines.reduce((sum, line) => {
        if (line.sku !== order.sku) return sum
        return sum + line.qty * order.price
      }, 0)
      const calc = computePpn({
        subtotal,
        rate: tax.ppnRate,
        priceMode: tax.priceMode,
      })
      const location = readAppSettings().stock.defaultLocation
      const customer = getCustomer(order.customerId)
      const party = customer?.name ?? order.customerId
      const postedAt = new Date().toISOString()

      for (const line of current.lines) {
        addMovement({
          type: 'in',
          sku: line.sku,
          productName: line.productName,
          unit: line.unit,
          qty: line.qty,
          fromLocation: party,
          toLocation: location,
          note: `Retur penjualan ${current.id} · ${order.id}`,
        })
      }
      creditReceivable(order.id, calc.total)
      const taxDocDate = journalDateFromIso(postedAt)
      recordTaxDoc({
        sourceType: 'saleReturn',
        sourceId: current.id,
        date: taxDocDate,
        ppnRate: tax.ppnRate,
        priceMode: tax.priceMode,
        dpp: calc.dpp,
        ppn: calc.ppn,
        total: calc.total,
        partyName: party,
      })
      const journalError = postPenjualanReturnJournal(postJournalEntry, mapAccount, {
        date: taxDocDate,
        memo: `Retur penjualan ${current.id} · ${order.id}`,
        sourceKey: `sr:${current.id}:post`,
        dpp: calc.dpp,
        ppn: calc.ppn,
        total: calc.total,
        cogsAmount: cogs.amount,
      })
      setReturns((list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                stage: 'posted',
                postedAt,
                ppnRate: tax.ppnRate,
                priceMode: tax.priceMode,
                dpp: calc.dpp,
                ppn: calc.ppn,
                totalWithTax: calc.total,
              }
            : r,
        ),
      )
      appendAudit({
        action: 'return',
        entity: 'sale',
        entityId: current.id,
        note: `Retur ${order.id}`,
      })
      return journalError ? { ok: true, journalError } : { ok: true }
    },
    [
      items,
      returns,
      lotCosts,
      addMovement,
      creditReceivable,
      postJournalEntry,
      mapAccount,
      appendAudit,
      recordTaxDoc,
      user?.role,
    ],
  )

  const value = useMemo(
    () => ({
      orders,
      createOrder,
      deleteOrder,
      voidOrder,
      shipOrder,
      addPayment,
      returns,
      createSaleReturn,
      submitSaleReturn,
      approveSaleReturn,
      rejectSaleReturn,
      postSaleReturn,
    }),
    [
      orders,
      createOrder,
      deleteOrder,
      voidOrder,
      shipOrder,
      addPayment,
      returns,
      createSaleReturn,
      submitSaleReturn,
      approveSaleReturn,
      rejectSaleReturn,
      postSaleReturn,
    ],
  )

  return (
    <PenjualanContext.Provider value={value}>{children}</PenjualanContext.Provider>
  )
}

export function usePenjualan(): PenjualanContextValue {
  const ctx = useContext(PenjualanContext)
  if (!ctx) throw new Error('usePenjualan harus dipakai di dalam PenjualanProvider')
  return ctx
}

export function useSelectedOrder() {
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
    (section: PenjualanSection, id: string) => {
      const base =
        section === 'order' ? PENJUALAN_BASE : `${PENJUALAN_BASE}/${section}`
      navigate(`${base}?dok=${encodeURIComponent(id)}`)
    },
    [navigate],
  )

  return { selectedId, select, goTo }
}
