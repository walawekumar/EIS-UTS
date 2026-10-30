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
import type { UserRole } from '@/types/auth'
import {
  calcWeighing,
  effectiveUnitPrice,
  type Purchase,
} from '@/features/pembelian/pembelian-data'
import { pembelianRepository } from '@/features/pembelian/pembelian-storage'
import { keuanganRepository } from '@/features/keuangan/keuangan-storage'
import {
  berasQty,
  computeLotCost,
  nextBatchId,
  nextPackRunId,
  resolveLotIdFromBatch,
  sumPackRunOutQty,
  type BatchLine,
  type LotCost,
  type NewBatchInput,
  type PackRun,
  type PackRunLine,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'
import { produksiRepository } from '@/features/produksi/produksi-storage'
import { stockKey } from '@/features/persediaan/persediaan-data'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { publishSync } from '@/features/sync/sync-bus'

function roleAllowed(role: UserRole | undefined, allowed: UserRole[]): boolean {
  if (!role) return false
  return allowed.includes(role)
}

function purchaseUnitPrice(purchase: Purchase): number {
  if (purchase.effectivePrice != null) return purchase.effectivePrice
  if (purchase.weighing) {
    return effectiveUnitPrice(
      purchase.grain,
      purchase.price,
      purchase.weighing.moisture,
    )
  }
  return purchase.price
}

function grainValueForPurchase(purchase: Purchase): number {
  const unit = purchaseUnitPrice(purchase)
  if (purchase.weighing) {
    const netto = calcWeighing(purchase.grain, purchase.weighing).netto
    return netto * unit
  }
  return purchase.estimatedKg * unit
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function proportionalOpsForBatch(
  batch: ProductionBatch,
  allBatches: ProductionBatch[],
): number {
  const key = monthKey(batch.date)
  const expenses = keuanganRepository.load().expenses
  const periodTotal = expenses
    .filter((e) => e.status === 'posted' && e.date.startsWith(key))
    .reduce((s, e) => s + e.amount, 0)
  if (periodTotal <= 0) return 0

  const periodInput = allBatches
    .filter((b) => b.stage === 'done' && b.date.startsWith(key))
    .reduce((s, b) => s + b.inputQty, 0)
  if (periodInput <= 0) return 0

  return (periodTotal * batch.inputQty) / periodInput
}

export type ProduksiSection = 'batch' | 'input-output' | 'rendemen'

export const PRODUKSI_BASE = '/app/produksi'

export type RecalcLotCostOptions = {
  method: 'manual' | 'proportional'
  manualOps?: number
}

export type NewPackRunInput = {
  batchId: string
  sourceSku: string
  lines: PackRunLine[]
}

type ProduksiContextValue = {
  batches: ProductionBatch[]
  packRuns: PackRun[]
  lotCosts: LotCost[]
  createBatch: (data: NewBatchInput) => string
  updateOutputs: (id: string, outputs: BatchLine[]) => void
  submitBatch: (id: string) => void
  approveBatch: (id: string) => void
  rejectBatch: (id: string, reason: string) => void
  startBatch: (id: string) => void
  completeBatch: (id: string) => void
  voidBatch: (id: string, reason: string) => void
  deleteBatch: (id: string) => void
  createPackRun: (input: NewPackRunInput) => string
  updatePackRun: (id: string, lines: PackRunLine[]) => string | undefined
  postPackRun: (id: string) => string | undefined
  voidPackRun: (id: string) => string | undefined
  recalcLotCost: (batchId: string, opts: RecalcLotCostOptions) => string | undefined
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

function postPackStock(
  run: PackRun,
  batch: ProductionBatch,
  addMovement: ReturnType<typeof usePersediaanStore>['addMovement'],
  reverse: boolean,
) {
  const sourceLine = batch.outputs.find((o) => o.sku === run.sourceSku)
  const sourceName = sourceLine?.productName ?? run.sourceSku
  const sourceUnit = sourceLine?.unit ?? 'kg'
  const fromLoc = batch.toLocation
  const totalOut = sumPackRunOutQty(run)
  const sign = reverse ? 'Void pack' : 'Pack'

  if (reverse) {
    addMovement({
      type: 'in',
      sku: run.sourceSku,
      productName: sourceName,
      unit: sourceUnit,
      qty: totalOut,
      fromLocation: '—',
      toLocation: fromLoc,
      note: `${sign} ${run.id} — kembalikan ${sourceName}`,
    })
    for (const line of run.lines) {
      if (!line.qty || line.qty <= 0) continue
      addMovement({
        type: 'out',
        sku: line.sku,
        productName: line.productName,
        unit: line.unit,
        qty: line.qty,
        fromLocation: line.location,
        toLocation: '—',
        note: `${sign} ${run.id} — tarik ${line.productName}`,
      })
    }
  } else {
    addMovement({
      type: 'out',
      sku: run.sourceSku,
      productName: sourceName,
      unit: sourceUnit,
      qty: totalOut,
      fromLocation: fromLoc,
      toLocation: 'Packing',
      note: `Pack ${run.id} · batch ${batch.id}`,
    })
    for (const line of run.lines) {
      if (!line.qty || line.qty <= 0) continue
      addMovement({
        type: 'in',
        sku: line.sku,
        productName: line.productName,
        unit: line.unit,
        qty: line.qty,
        fromLocation: 'Packing',
        toLocation: line.location,
        note: `Pack ${run.id} · ${line.grade ? `grade ${line.grade}` : line.productName}`,
      })
    }
  }
}

function stockOnHand(
  stocks: ReturnType<typeof usePersediaanStore>['stocks'],
  sku: string,
  location: string,
): number {
  const row = stocks.find((s) => stockKey(s.sku, s.location) === stockKey(sku, location))
  return row?.qty ?? 0
}

export function ProduksiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { appendAudit } = useAuditStore()
  const { stocks, addMovement } = usePersediaanStore()
  const boot = produksiRepository.load()
  const [items, setItems] = useState<ProductionBatch[]>(() => boot.batches)
  const [packRuns, setPackRuns] = useState<PackRun[]>(() => boot.packRuns)
  const [lotCosts, setLotCosts] = useState<LotCost[]>(() => boot.lotCosts)

  useEffect(() => {
    produksiRepository.save({
      version: 1,
      batches: items,
      packRuns,
      lotCosts,
      updatedAt: new Date().toISOString(),
    })
  }, [items, packRuns, lotCosts])

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

  const persistLotCostForBatch = useCallback(
    (
      batch: ProductionBatch,
      allBatches: ProductionBatch[],
      opts: RecalcLotCostOptions,
    ): string | undefined => {
      if (batch.stage !== 'done') return 'Costing hanya untuk batch selesai.'

      const lotId = resolveLotIdFromBatch(batch)
      if (!lotId) return undefined

      const { purchases } = pembelianRepository.load()
      const purchase = purchases.find(
        (p) => p.lotId === lotId && !p.voidedAt,
      )
      if (!purchase) return `Tidak ada pembelian untuk lot ${lotId}.`

      const qtyBeras = berasQty(batch)
      const grainValue = grainValueForPurchase(purchase)
      let allocatedOps = 0
      if (opts.method === 'manual') {
        allocatedOps = opts.manualOps ?? 0
        if (!Number.isFinite(allocatedOps) || allocatedOps < 0) {
          return 'Alokasi biaya manual tidak valid.'
        }
      } else {
        allocatedOps = proportionalOpsForBatch(batch, allBatches)
      }

      const snapshot = computeLotCost({
        lotId,
        batchId: batch.id,
        grainValue,
        allocatedOps,
        berasQty: qtyBeras,
        method: opts.method,
      })

      setLotCosts((list) => [
        ...list.filter((c) => c.batchId !== batch.id),
        snapshot,
      ])
      publishSync('produksi', batch.id)
      return undefined
    },
    [],
  )

  const recalcLotCost = useCallback(
    (batchId: string, opts: RecalcLotCostOptions): string | undefined => {
      const batch = items.find((b) => b.id === batchId)
      if (!batch) return 'Batch tidak ditemukan.'
      return persistLotCostForBatch(batch, items, opts)
    },
    [items, persistLotCostForBatch],
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

      const completedAt = new Date().toISOString()
      const doneBatch: ProductionBatch = {
        ...current,
        stage: 'done',
        completedAt,
        stockPosted: true,
        startedAt: current.startedAt ?? completedAt,
      }
      const batchesForCosting = items.map((b) => (b.id === id ? doneBatch : b))

      patch(
        id,
        () => doneBatch,
        { action: 'post', note: 'Batch selesai — stok diposting' },
      )

      persistLotCostForBatch(doneBatch, batchesForCosting, {
        method: 'proportional',
      })
    },
    [items, addMovement, patch, persistLotCostForBatch],
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

  const sortedPackRuns = useMemo(
    () =>
      [...packRuns].sort((a, b) =>
        a.createdAt === b.createdAt
          ? b.id.localeCompare(a.id)
          : b.createdAt.localeCompare(a.createdAt),
      ),
    [packRuns],
  )

  const createPackRun = useCallback(
    (input: NewPackRunInput): string => {
      const batch = items.find((b) => b.id === input.batchId)
      const id = nextPackRunId(packRuns)
      const row: PackRun = {
        id,
        batchId: input.batchId,
        sourceSku: input.sourceSku,
        lines: input.lines,
        stage: 'draft',
        createdAt: new Date().toISOString(),
      }
      setPackRuns((list) => [row, ...list])
      appendAudit({
        action: 'create',
        entity: 'batch',
        entityId: id,
        after: row,
        note: batch ? `Pack draft · ${batch.id}` : 'Pack draft',
      })
      publishSync('produksi', id)
      return id
    },
    [items, packRuns, appendAudit],
  )

  const updatePackRun = useCallback(
    (id: string, lines: PackRunLine[]): string | undefined => {
      const current = packRuns.find((r) => r.id === id)
      if (!current) return 'Pack run tidak ditemukan.'
      if (current.stage !== 'draft') return 'Hanya draft pack yang dapat diedit.'
      if (current.voidedAt) return 'Pack run sudah dibatalkan.'
      setPackRuns((list) =>
        list.map((r) => (r.id === id ? { ...r, lines } : r)),
      )
      appendAudit({
        action: 'update',
        entity: 'batch',
        entityId: id,
        before: current,
        after: { ...current, lines },
      })
      publishSync('produksi', id)
      return undefined
    },
    [packRuns, appendAudit],
  )

  const postPackRun = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['produksi', 'admin'])) {
        return 'Hanya produksi atau admin yang dapat memposting pack.'
      }
      const current = packRuns.find((r) => r.id === id)
      if (!current) return 'Pack run tidak ditemukan.'
      if (current.stage !== 'draft') return 'Pack run sudah diposting.'
      if (current.voidedAt) return 'Pack run sudah dibatalkan.'

      const batch = items.find((b) => b.id === current.batchId)
      if (!batch || batch.stage !== 'done') {
        return 'Batch produksi harus selesai (done).'
      }
      const activeLines = current.lines.filter((l) => l.qty > 0)
      if (!activeLines.length) {
        return 'Minimal satu baris pack wajib qty > 0.'
      }

      const toPost: PackRun = { ...current, lines: activeLines }
      const totalOut = sumPackRunOutQty(toPost)
      if (totalOut <= 0) return 'Total qty pack tidak valid.'

      const available = stockOnHand(stocks, current.sourceSku, batch.toLocation)
      if (totalOut > available) {
        return `Stok ${current.sourceSku} di ${batch.toLocation} tidak cukup (tersedia ${available}).`
      }

      postPackStock(toPost, batch, addMovement, false)
      const postedAt = new Date().toISOString()
      const posted = { ...toPost, stage: 'posted' as const, postedAt }
      setPackRuns((list) =>
        list.map((r) => (r.id === id ? posted : r)),
      )
      appendAudit({
        action: 'post',
        entity: 'batch',
        entityId: id,
        before: current,
        after: posted,
        note: `Pack ${batch.id} · ${totalOut} kg`,
      })
      publishSync('produksi', id)
      return undefined
    },
    [packRuns, items, stocks, addMovement, appendAudit, user?.role],
  )

  const voidPackRun = useCallback(
    (id: string): string | undefined => {
      if (!roleAllowed(user?.role, ['produksi', 'admin'])) {
        return 'Hanya produksi atau admin yang dapat void pack.'
      }
      const current = packRuns.find((r) => r.id === id)
      if (!current) return 'Pack run tidak ditemukan.'
      if (current.stage !== 'posted') return 'Hanya pack posted yang dapat di-void.'
      if (current.voidedAt) return 'Pack run sudah di-void.'

      const batch = items.find((b) => b.id === current.batchId)
      if (!batch) return 'Batch produksi tidak ditemukan.'

      for (const line of current.lines) {
        if (!line.qty || line.qty <= 0) continue
        const onHand = stockOnHand(stocks, line.sku, line.location)
        if (line.qty > onHand) {
          return `Stok ${line.sku} di ${line.location} tidak cukup untuk void (${onHand}).`
        }
      }

      postPackStock(current, batch, addMovement, true)
      const voidedAt = new Date().toISOString()
      setPackRuns((list) =>
        list.map((r) => (r.id === id ? { ...r, voidedAt } : r)),
      )
      appendAudit({
        action: 'void',
        entity: 'batch',
        entityId: id,
        before: current,
        after: { ...current, voidedAt },
      })
      publishSync('produksi', id)
      return undefined
    },
    [packRuns, items, stocks, addMovement, appendAudit, user?.role],
  )

  const value = useMemo(
    () => ({
      batches,
      packRuns: sortedPackRuns,
      lotCosts,
      createBatch,
      updateOutputs,
      submitBatch,
      approveBatch,
      rejectBatch,
      startBatch,
      completeBatch,
      voidBatch,
      deleteBatch,
      createPackRun,
      updatePackRun,
      postPackRun,
      voidPackRun,
      recalcLotCost,
    }),
    [
      batches,
      sortedPackRuns,
      lotCosts,
      createBatch,
      updateOutputs,
      submitBatch,
      approveBatch,
      rejectBatch,
      startBatch,
      completeBatch,
      voidBatch,
      deleteBatch,
      createPackRun,
      updatePackRun,
      postPackRun,
      voidPackRun,
      recalcLotCost,
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
