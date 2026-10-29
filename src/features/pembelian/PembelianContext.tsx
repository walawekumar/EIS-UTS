import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  INITIAL_PURCHASES,
  PAYMENT_TERM_DAYS,
  addDays,
  nextPaymentId,
  nextPurchaseId,
  todayIso,
  type NewPurchase,
  type Payment,
  type Purchase,
  type WeighingInput,
} from '@/features/pembelian/pembelian-data'

export type PembelianSection = 'pencatatan' | 'penerimaan' | 'pembayaran'

export const PEMBELIAN_BASE = '/app/pembelian'

type PembelianContextValue = {
  /** Urut terbaru dulu */
  purchases: Purchase[]
  createPurchase: (data: NewPurchase) => string
  deletePurchase: (id: string) => void
  saveWeighing: (id: string, input: WeighingInput) => void
  confirmWeighing: (id: string, input: WeighingInput) => void
  addPayment: (id: string, payment: Omit<Payment, 'id'>) => void
}

const PembelianContext = createContext<PembelianContextValue | null>(null)

// Data masih lokal — diganti Supabase nanti
export function PembelianProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Purchase[]>(INITIAL_PURCHASES)

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
      const id = nextPurchaseId(items, new Date(`${data.date}T00:00:00`))
      setItems((list) => [{ ...data, id, stage: 'dicatat', payments: [] }, ...list])
      return id
    },
    [items],
  )

  const deletePurchase = useCallback((id: string) => {
    setItems((list) => list.filter((p) => p.id !== id))
  }, [])

  const saveWeighing = useCallback(
    (id: string, input: WeighingInput) => {
      patch(id, () => ({ stage: 'ditimbang', weighing: { ...input, weighedAt: todayIso() } }))
    },
    [patch],
  )

  const confirmWeighing = useCallback(
    (id: string, input: WeighingInput) => {
      const today = todayIso()
      patch(id, (p) => ({
        stage: 'diterima',
        weighing: { ...input, weighedAt: p.weighing?.weighedAt ?? today, confirmedAt: today },
        dueDate: addDays(today, PAYMENT_TERM_DAYS),
      }))
    },
    [patch],
  )

  const addPayment = useCallback(
    (id: string, payment: Omit<Payment, 'id'>) => {
      const payId = nextPaymentId(items)
      patch(id, (p) => ({ payments: [...p.payments, { ...payment, id: payId }] }))
    },
    [items, patch],
  )

  const value = useMemo(
    () => ({ purchases, createPurchase, deletePurchase, saveWeighing, confirmWeighing, addPayment }),
    [purchases, createPurchase, deletePurchase, saveWeighing, confirmWeighing, addPayment],
  )

  return <PembelianContext.Provider value={value}>{children}</PembelianContext.Provider>
}

export function usePembelian(): PembelianContextValue {
  const ctx = useContext(PembelianContext)
  if (!ctx) throw new Error('usePembelian harus dipakai di dalam PembelianProvider')
  return ctx
}

/** Dokumen terpilih disimpan di URL (?dok=PB-…) agar bisa dibagikan antar sub-halaman. */
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
      navigate(`${PEMBELIAN_BASE}/${section}?dok=${encodeURIComponent(id)}`)
    },
    [navigate],
  )

  return { selectedId, select, goTo }
}
