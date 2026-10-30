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
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { lookupCustomer } from '@/features/master/master-storage'
import {
  addDays,
  getCustomer,
  nextOrderId,
  nextPaymentId,
  todayIso,
  type DeliveryInput,
  type NewSaleOrder,
  type Payment,
  type SaleOrder,
} from '@/features/penjualan/penjualan-data'
import { penjualanRepository } from '@/features/penjualan/penjualan-storage'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import {
  getOrderPrefix,
  getPaymentTermDays,
  readAppSettings,
} from '@/features/settings/app-settings'

export type PenjualanSection = 'order' | 'pengiriman' | 'tagihan'

export const PENJUALAN_BASE = '/app/penjualan'

type PenjualanContextValue = {
  orders: SaleOrder[]
  createOrder: (data: NewSaleOrder) => string
  deleteOrder: (id: string) => void
  voidOrder: (id: string, reason: string) => void
  shipOrder: (id: string, input: DeliveryInput) => string | null
  addPayment: (id: string, payment: Omit<Payment, 'id'>) => void
}

const PenjualanContext = createContext<PenjualanContextValue | null>(null)

export function PenjualanProvider({ children }: { children: ReactNode }) {
  const {
    upsertReceivableFromSale,
    applySalePayment,
    addCashEntry,
    removeLinkedReceivable,
    receivables,
  } = useFinanceStore()
  const { addMovement } = usePersediaanStore()
  const { appendAudit } = useAuditStore()
  const [items, setItems] = useState<SaleOrder[]>(
    () => penjualanRepository.load().orders,
  )

  useEffect(() => {
    penjualanRepository.save({
      version: 1,
      orders: items,
      updatedAt: new Date().toISOString(),
    })
  }, [items])

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

  const value = useMemo(
    () => ({
      orders,
      createOrder,
      deleteOrder,
      voidOrder,
      shipOrder,
      addPayment,
    }),
    [orders, createOrder, deleteOrder, voidOrder, shipOrder, addPayment],
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
