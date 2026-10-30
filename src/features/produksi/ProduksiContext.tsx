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
import {
  nextBatchId,
  type BatchLine,
  type NewBatchInput,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'
import { produksiRepository } from '@/features/produksi/produksi-storage'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { publishSync } from '@/features/sync/sync-bus'

export type ProduksiSection = 'batch' | 'input-output' | 'rendemen'

export const PRODUKSI_BASE = '/app/produksi'

type ProduksiContextValue = {
  batches: ProductionBatch[]
  createBatch: (data: NewBatchInput) => string
  updateOutputs: (id: string, outputs: BatchLine[]) => void
  submitBatch: (id: string) => void
  approveBatch: (id: string) => void
  rejectBatch: (id: string, reason: string) => void
  startBatch: (id: string) => void
  completeBatch: (id: string) => void
  voidBatch: (id: string, reason: string) => void
  deleteBatch: (id: string) => void
}

const ProduksiContext = createContext<ProduksiContextValue | null>(null)

function postStock(
  batch: ProductionBatch,
  addMovement: ReturnType<typeof usePersediaanStore>['addMovement'],
  reverse: boolean,
) {
  const signNote = reverse ? 'Void' : 'Output'

  // Gabah keluar dari lokasi sumber (atau masuk kembali saat void)
  if (reverse) {
    addMovement({
      type: 'in',
      sku: batch.inputSku,
      productName: batch.inputName,
      unit: batch.inputUnit,
      qty: batch.inputQty,
      fromLocation: '—',
      toLocation: batch.fromLocation,
      note: `${signNote} ${batch.id} — kembalikan gabah`,
    })
  } else {
    addMovement({
      type: 'out',
      sku: batch.inputSku,
      productName: batch.inputName,
      unit: batch.inputUnit,
      qty: batch.inputQty,
      fromLocation: batch.fromLocation,
      toLocation: batch.processLocation,
      note: `Input produksi ${batch.id}`,
    })
  }

  for (const line of batch.outputs) {
    if (!line.qty || line.qty <= 0) continue
    if (reverse) {
      addMovement({
        type: 'out',
        sku: line.sku,
        productName: line.productName,
        unit: line.unit,
        qty: line.qty,
        fromLocation: batch.toLocation,
        toLocation: '—',
        note: `${signNote} ${batch.id} — tarik ${line.productName}`,
      })
    } else {
      addMovement({
        type: 'in',
        sku: line.sku,
        productName: line.productName,
        unit: line.unit,
        qty: line.qty,
        fromLocation: batch.processLocation,
        toLocation: batch.toLocation,
        note: `Output produksi ${batch.id}`,
      })
    }
  }
}

export function ProduksiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { appendAudit } = useAuditStore()
  const { addMovement } = usePersediaanStore()
  const [items, setItems] = useState<ProductionBatch[]>(
    () => produksiRepository.load().batches,
  )

  useEffect(() => {
    produksiRepository.save({
      version: 1,
      batches: items,
      updatedAt: new Date().toISOString(),
    })
  }, [items])

  const batches = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
      ),
    [items],
  )

  const patch = useCallback(
    (
      id: string,
      fn: (b: ProductionBatch) => ProductionBatch,
      audit?: {
        action: Parameters<typeof appendAudit>[0]['action']
        note?: string
      },
    ) => {
      setItems((list) => {
        const idx = list.findIndex((b) => b.id === id)
        if (idx < 0) return list
        const before = list[idx]
        const after = fn(before)
        const copy = [...list]
        copy[idx] = after
        if (audit) {
          appendAudit({
            action: audit.action,
            entity: 'batch',
            entityId: id,
            before,
            after,
            note: audit.note,
          })
        }
        publishSync('produksi', id)
        return copy
      })
    },
    [appendAudit],
  )

  const createBatch = useCallback(
    (data: NewBatchInput) => {
      const id = nextBatchId(items, new Date(`${data.date}T00:00:00`))
      const row: ProductionBatch = {
        ...data,
        id,
        stage: 'draft',
        stockPosted: false,
      }
      setItems((list) => [row, ...list])
      appendAudit({
        action: 'create',
        entity: 'batch',
        entityId: id,
        after: row,
      })
      publishSync('produksi', id)
      return id
    },
    [items, appendAudit],
  )

  const updateOutputs = useCallback(
    (id: string, outputs: BatchLine[]) => {
      patch(id, (b) => {
        if (b.stage === 'done' || b.stage === 'void') return b
        return { ...b, outputs }
      }, { action: 'update', note: 'Update output' })
    },
    [patch],
  )

  const submitBatch = useCallback(
    (id: string) => {
      patch(
        id,
        (b) => {
          if (b.stage !== 'draft' && b.stage !== 'rejected') return b
          if (b.inputQty <= 0 || !b.outputs.some((o) => o.qty > 0)) return b
          return {
            ...b,
            stage: 'submitted',
            submittedAt: new Date().toISOString(),
            rejectReason: undefined,
            rejectedAt: undefined,
          }
        },
        { action: 'submit' },
      )
    },
    [patch],
  )

  const approveBatch = useCallback(
    (id: string) => {
      patch(
        id,
        (b) => {
          if (b.stage !== 'submitted') return b
          return {
            ...b,
            stage: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: user?.name ?? 'Admin',
          }
        },
        { action: 'approve' },
      )
    },
    [patch, user?.name],
  )

  const rejectBatch = useCallback(
    (id: string, reason: string) => {
      patch(
        id,
        (b) => {
          if (b.stage !== 'submitted') return b
          return {
            ...b,
            stage: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectReason: reason || 'Ditolak',
          }
        },
        { action: 'reject', note: reason },
      )
    },
    [patch],
  )

  const startBatch = useCallback(
    (id: string) => {
      patch(
        id,
        (b) => {
          if (b.stage !== 'approved') return b
          return {
            ...b,
            stage: 'processing',
            startedAt: new Date().toISOString(),
          }
        },
        { action: 'start' },
      )
    },
    [patch],
  )

  const completeBatch = useCallback(
    (id: string) => {
      const current = items.find((b) => b.id === id)
      if (!current) return
      if (current.stage !== 'processing' && current.stage !== 'approved') return
      if (current.inputQty <= 0 || !current.outputs.some((o) => o.qty > 0)) return

      if (!current.stockPosted) {
        postStock(current, addMovement, false)
      }

      patch(
        id,
        (b) => ({
          ...b,
          stage: 'done',
          completedAt: new Date().toISOString(),
          stockPosted: true,
          startedAt: b.startedAt ?? new Date().toISOString(),
        }),
        { action: 'post', note: 'Batch selesai — stok diposting' },
      )
    },
    [items, addMovement, patch],
  )

  const voidBatch = useCallback(
    (id: string, reason: string) => {
      const current = items.find((b) => b.id === id)
      if (!current) return
      if (current.stage === 'void' || current.stage === 'draft') return

      if (current.stockPosted) {
        postStock(current, addMovement, true)
      }

      patch(
        id,
        (b) => ({
          ...b,
          stage: 'void',
          voidedAt: new Date().toISOString(),
          voidReason: reason || 'Dibatalkan',
          stockPosted: false,
        }),
        { action: 'void', note: reason },
      )
    },
    [items, addMovement, patch],
  )

  const deleteBatch = useCallback(
    (id: string) => {
      setItems((list) => {
        const target = list.find((b) => b.id === id)
        if (!target || (target.stage !== 'draft' && target.stage !== 'rejected')) {
          return list
        }
        appendAudit({
          action: 'delete',
          entity: 'batch',
          entityId: id,
          before: target,
        })
        publishSync('produksi', id)
        return list.filter((b) => b.id !== id)
      })
    },
    [appendAudit],
  )

  const value = useMemo(
    () => ({
      batches,
      createBatch,
      updateOutputs,
      submitBatch,
      approveBatch,
      rejectBatch,
      startBatch,
      completeBatch,
      voidBatch,
      deleteBatch,
    }),
    [
      batches,
      createBatch,
      updateOutputs,
      submitBatch,
      approveBatch,
      rejectBatch,
      startBatch,
      completeBatch,
      voidBatch,
      deleteBatch,
    ],
  )

  return (
    <ProduksiContext.Provider value={value}>{children}</ProduksiContext.Provider>
  )
}

export function useProduksi(): ProduksiContextValue {
  const ctx = useContext(ProduksiContext)
  if (!ctx) throw new Error('useProduksi harus di dalam ProduksiProvider')
  return ctx
}

export function useSelectedBatch() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedId = params.get('dok')

  function select(id: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('dok', id)
      else next.delete('dok')
      return next
    })
  }

  function goTo(section: ProduksiSection, id?: string) {
    const path =
      section === 'batch'
        ? PRODUKSI_BASE
        : `${PRODUKSI_BASE}/${section}`
    const q = id ? `?dok=${encodeURIComponent(id)}` : ''
    navigate(`${path}${q}`)
  }

  return { selectedId, select, goTo }
}
