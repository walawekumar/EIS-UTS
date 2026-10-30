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
import { lookupCustomer } from '@/features/master/master-storage'
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

export type SaleReturnInput = {
  /** Set to edit an existing draft or ditolak return. */
  id?: string
  orderId: string
  lines: SaleReturnLine[]
  reason: string
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
  voidOrder: (id: string, reason: string) => void
  shipOrder: (id: string, input: DeliveryInput) => string | null
  addPayment: (id: string, payment: Omit<Payment, 'id'>) => void
  returns: SaleReturn[]
  createSaleReturn: (input: SaleReturnInput) => string | undefined
  submitSaleReturn: (id: string) => string | undefined
  approveSaleReturn: (id: string) => string | undefined
  rejectSaleReturn: (id: string, reason: string) => string | undefined
  postSaleReturn: (id: string) => string | undefined
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
    receivables,
  } = useFinanceStore()
  const { addMovement } = usePersediaanStore()
  const { appendAudit } = useAuditStore()
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
    (id: string, reason: string) => {
      const current = items.find((o) => o.id === id)
      if (!current || current.voidedAt || current.stage !== 'dikirim') return
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
    },
    [items, addMovement, removeLinkedReceivable, appendAudit],
  )

  const shipOrder = useCallback(
    (id: string, input: DeliveryInput): string | null => {
      const today = todayIso()
      const termDays = getPaymentTermDays()
      const location = readAppSettings().stock.defaultLocation
      const current = items.find((o) => o.id === id)
      if (!current || current.voidedAt) return 'Order tidak ditemukan'

      const total = current.qty * current.price
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
            return `Melebihi limit kredit (${limit.toLocaleString('id-ID')}). Outstanding ${openAr.toLocaleString('id-ID')}`
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

      if (isPaid) {
        addCashEntry({
          direction: 'in',
          category: 'Penjualan',
          description: `Pelunasan kirim ${next.id} · ${party}`,
          amount: total,
          receiptName: input.payReceiptName,
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
      return null
    },
    [
      addCashEntry,
      addMovement,
      items,
      upsertReceivableFromSale,
      receivables,
      appendAudit,
    ],
  )

  const addPayment = useCallback(
    (id: string, payment: Omit<Payment, 'id'>) => {
      const current = items.find((o) => o.id === id)
      if (!current) return
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
    },
    [applySalePayment, items],
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
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['keuangan', 'admin'])) {
        return 'Hanya keuangan atau admin yang dapat memposting retur.'
      }
      const current = returns.find((r) => r.id === id)
      if (!current) return 'Dokumen retur tidak ditemukan.'
      if (current.stage !== 'disetujui') {
        return 'Hanya retur disetujui yang dapat diposting.'
      }
      const order = items.find((o) => o.id === current.orderId)
      if (!order) return 'Order penjualan tidak ditemukan.'
      if (order.voidedAt) return 'Order penjualan sudah dibatalkan.'
      const qtyError = returnQtyError(order, current.lines, returns)
      if (qtyError) return qtyError

      const unitPrice = order.price
      const credit = current.lines.reduce(
        (sum, line) => sum + line.qty * unitPrice,
        0,
      )
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
      creditReceivable(order.id, credit)
      setReturns((list) =>
        list.map((r) =>
          r.id === id ? { ...r, stage: 'posted', postedAt } : r,
        ),
      )
      appendAudit({
        action: 'return',
        entity: 'sale',
        entityId: current.id,
        note: `Retur ${order.id}`,
      })
      return undefined
    },
    [items, returns, addMovement, creditReceivable, appendAudit, user?.role],
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
