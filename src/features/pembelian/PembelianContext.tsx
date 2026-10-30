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
  type NewPurchase,
  type Payment,
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

export type PembelianSection = 'pencatatan' | 'penerimaan' | 'pembayaran'

export const PEMBELIAN_BASE = '/app/pembelian'

const GRAIN_SKU: Record<string, { sku: string; name: string }> = {
  GKP: { sku: 'GBH-IR64', name: 'Gabah IR64 (GKP)' },
  GKG: { sku: 'GBH-CIHERANG', name: 'Gabah Ciherang (GKG)' },
}

type PembelianContextValue = {
  purchases: Purchase[]
  createPurchase: (data: NewPurchase) => string
  deletePurchase: (id: string) => void
  voidPurchase: (id: string, reason: string) => void
  saveWeighing: (id: string, input: WeighingInput) => void
  confirmWeighing: (id: string, input: WeighingInput) => void
  addPayment: (id: string, payment: Omit<Payment, 'id'>) => void
}

const PembelianContext = createContext<PembelianContextValue | null>(null)

export function PembelianProvider({ children }: { children: ReactNode }) {
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
    (id: string, reason: string) => {
      const current = items.find((p) => p.id === id)
      if (!current || current.voidedAt) return
      if (!canVoidPurchase(current.stage)) return
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
    },
    [items, addMovement, removeLinkedPayable, appendAudit],
  )

  const saveWeighing = useCallback(
    (id: string, input: WeighingInput) => {
      const { receiptName, ...measures } = input
      patch(id, (p) => ({
        stage: 'ditimbang',
        weighing: {
          ...measures,
          weighedAt: todayIso(),
          receiptName: receiptName ?? p.weighing?.receiptName,
        },
      }))
    },
    [patch],
  )

  const confirmWeighing = useCallback(
    (id: string, input: WeighingInput) => {
      const today = todayIso()
      const termDays = getPaymentTermDays()
      const dueDate = addDays(today, termDays)
      const { receiptName, ...measures } = input

      const current = items.find((p) => p.id === id)
      if (!current) return

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
        stage: 'selesai',
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
    },
    [addMovement, items, upsertPayableFromPurchase, appendAudit],
  )

  const addPayment = useCallback(
    (id: string, payment: Omit<Payment, 'id'>) => {
      const current = items.find((p) => p.id === id)
      if (!current) return
      const payId = nextPaymentId(items)
      const next: Purchase = {
        ...current,
        payments: [...current.payments, { ...payment, id: payId }],
      }
      const supplier = getSupplier(next.supplierId)

      setItems((list) => list.map((p) => (p.id === id ? next : p)))
      applyPurchasePayment({
        sourceId: next.id,
        amount: payment.amount,
        party: supplier?.name ?? next.supplierId,
        invoice: next.id,
        receiptName: payment.receiptName,
        note: payment.method,
      })
    },
    [applyPurchasePayment, items],
  )

  const value = useMemo(
    () => ({
      purchases,
      createPurchase,
      deletePurchase,
      voidPurchase,
      saveWeighing,
      confirmWeighing,
      addPayment,
    }),
    [
      purchases,
      createPurchase,
      deletePurchase,
      voidPurchase,
      saveWeighing,
      confirmWeighing,
      addPayment,
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
