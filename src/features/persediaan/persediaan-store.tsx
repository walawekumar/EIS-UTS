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
import { useAuth } from '@/features/auth/AuthContext'
import {
  formatDateId,
  nextCorrectionRef,
  nextMovementRef,
  stockKey,
  type CorrectionRow,
  type MovementRow,
  type MovementType,
  type StockRow,
} from '@/features/persediaan/persediaan-data'
import {
  loadPersediaanCloud,
  mapSupabaseError,
  savePersediaanCloud,
} from '@/features/persediaan/persediaan-cloud'
import { persediaanRepository } from '@/features/persediaan/persediaan-storage'
import { assertPeriodOpen } from '@/features/keuangan/period-gate'
import { todayIsoDate } from '@/features/keuangan/period-helpers'
import { isSupabaseConfigured } from '@/lib/supabase-client'

type MovementInput = {
  type: MovementType
  sku: string
  productName: string
  unit: string
  qty: number
  fromLocation: string
  toLocation: string
  note: string
  receiptName?: string
}

type CorrectionInput = {
  sku: string
  productName: string
  location: string
  unit: string
  beforeQty: number
  afterQty: number
  reason: string
  receiptName?: string
}

type PersediaanStoreValue = {
  stocks: StockRow[]
  movements: MovementRow[]
  corrections: CorrectionRow[]
  cloudReady: boolean
  persistError: string | null
  addMovement: (input: MovementInput) => void
  addCorrection: (input: CorrectionInput) => string | undefined
  voidCorrection: (id: string) => string | undefined
}

const PersediaanContext = createContext<PersediaanStoreValue | null>(null)

function adjustStock(
  list: StockRow[],
  sku: string,
  productName: string,
  category: StockRow['category'],
  location: string,
  unit: string,
  delta: number,
): StockRow[] {
  const key = stockKey(sku, location)
  const idx = list.findIndex((r) => stockKey(r.sku, r.location) === key)
  if (idx >= 0) {
    const next = [...list]
    const row = next[idx]
    next[idx] = {
      ...row,
      qty: Math.max(0, row.qty + delta),
      updatedAt: formatDateId(),
    }
    return next
  }
  if (delta <= 0) return list
  return [
    {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sku,
      name: productName,
      category,
      location,
      unit,
      qty: delta,
      minQty: 100,
      updatedAt: formatDateId(),
    },
    ...list,
  ]
}

function setStockQty(
  list: StockRow[],
  sku: string,
  location: string,
  qty: number,
): StockRow[] {
  return list.map((row) =>
    row.sku === sku && row.location === location
      ? { ...row, qty: Math.max(0, qty), updatedAt: formatDateId() }
      : row,
  )
}

function findCategory(stocks: StockRow[], sku: string): StockRow['category'] {
  return stocks.find((s) => s.sku === sku)?.category ?? 'gabah'
}

function snapshotOf(
  stocks: StockRow[],
  movements: MovementRow[],
  corrections: CorrectionRow[],
) {
  return {
    version: 1 as const,
    stocks,
    movements,
    corrections,
    updatedAt: new Date().toISOString(),
  }
}

export function PersediaanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const actor = user?.name ?? 'Pengguna'
  const configured = isSupabaseConfigured()

  const boot = configured
    ? {
        stocks: [] as StockRow[],
        movements: [] as MovementRow[],
        corrections: [] as CorrectionRow[],
      }
    : persediaanRepository.load()

  const [stocks, setStocks] = useState<StockRow[]>(() => [...boot.stocks])
  const [movements, setMovements] = useState<MovementRow[]>(() => [
    ...boot.movements,
  ])
  const [corrections, setCorrections] = useState<CorrectionRow[]>(() => [
    ...boot.corrections,
  ])
  const [cloudReady, setCloudReady] = useState(!configured)
  const [persistError, setPersistError] = useState<string | null>(null)
  const skipPersist = useRef(configured)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    void (async () => {
      try {
        const snap = await loadPersediaanCloud()
        if (cancelled) return
        skipPersist.current = true
        setStocks([...snap.stocks])
        setMovements([...snap.movements])
        setCorrections([...snap.corrections])
        setPersistError(null)
        setCloudReady(true)
      } catch (e) {
        if (cancelled) return
        setPersistError(mapSupabaseError(e))
        setCloudReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [configured])

  useEffect(() => {
    if (configured) {
      if (!cloudReady) return
      if (skipPersist.current) {
        skipPersist.current = false
        return
      }
      const handle = window.setTimeout(() => {
        void savePersediaanCloud(snapshotOf(stocks, movements, corrections))
          .then(() => setPersistError(null))
          .catch((e) => setPersistError(mapSupabaseError(e)))
      }, 300)
      return () => window.clearTimeout(handle)
    }
    persediaanRepository.save(snapshotOf(stocks, movements, corrections))
  }, [stocks, movements, corrections, cloudReady, configured])

  const addMovement = useCallback(
    (input: MovementInput) => {
      setMovements((list) => {
        const entry: MovementRow = {
          id: `m-${Date.now()}`,
          date: formatDateId(),
          reference: nextMovementRef(list),
          type: input.type,
          sku: input.sku,
          productName: input.productName,
          fromLocation: input.fromLocation || '—',
          toLocation: input.toLocation || '—',
          qty: input.qty,
          unit: input.unit,
          note: input.note,
          actor,
          receiptName: input.receiptName,
        }
        return [entry, ...list]
      })

      setStocks((list) => {
        const category = findCategory(list, input.sku)
        let next = list
        if (input.type === 'in') {
          next = adjustStock(
            next,
            input.sku,
            input.productName,
            category,
            input.toLocation,
            input.unit,
            input.qty,
          )
        } else if (input.type === 'out') {
          next = adjustStock(
            next,
            input.sku,
            input.productName,
            category,
            input.fromLocation,
            input.unit,
            -input.qty,
          )
        } else {
          next = adjustStock(
            next,
            input.sku,
            input.productName,
            category,
            input.fromLocation,
            input.unit,
            -input.qty,
          )
          next = adjustStock(
            next,
            input.sku,
            input.productName,
            category,
            input.toLocation,
            input.unit,
            input.qty,
          )
        }
        return next
      })
    },
    [actor],
  )

  const addCorrection = useCallback(
    (input: CorrectionInput): string | undefined => {
      const locked = assertPeriodOpen(todayIsoDate())
      if (locked) return locked
      setCorrections((list) => {
        const entry: CorrectionRow = {
          id: `k-${Date.now()}`,
          date: formatDateId(),
          reference: nextCorrectionRef(list),
          sku: input.sku,
          productName: input.productName,
          location: input.location,
          beforeQty: input.beforeQty,
          afterQty: input.afterQty,
          unit: input.unit,
          reason: input.reason,
          status: 'posted',
          actor,
          receiptName: input.receiptName,
        }
        return [entry, ...list]
      })
      setStocks((list) =>
        setStockQty(list, input.sku, input.location, input.afterQty),
      )
      return undefined
    },
    [actor],
  )

  const voidCorrection = useCallback((id: string): string | undefined => {
    const locked = assertPeriodOpen(todayIsoDate())
    if (locked) return locked
    setCorrections((list) => {
      const target = list.find((c) => c.id === id)
      if (!target || target.status === 'void') return list

      setStocks((stocksList) =>
        setStockQty(stocksList, target.sku, target.location, target.beforeQty),
      )

      return list.map((c) =>
        c.id === id ? { ...c, status: 'void' as const } : c,
      )
    })
    return undefined
  }, [])

  const value = useMemo(
    () => ({
      stocks,
      movements,
      corrections,
      cloudReady,
      persistError,
      addMovement,
      addCorrection,
      voidCorrection,
    }),
    [
      stocks,
      movements,
      corrections,
      cloudReady,
      persistError,
      addMovement,
      addCorrection,
      voidCorrection,
    ],
  )

  return (
    <PersediaanContext.Provider value={value}>
      {persistError ? (
        <div
          className="bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {persistError}
        </div>
      ) : null}
      {children}
    </PersediaanContext.Provider>
  )
}

export function usePersediaanStore(): PersediaanStoreValue {
  const ctx = useContext(PersediaanContext)
  if (!ctx) {
    throw new Error('usePersediaanStore harus di dalam PersediaanProvider')
  }
  return ctx
}
