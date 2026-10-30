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
import type { DualTrackResult } from '@/features/keuangan/dual-track-result'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import type { AccountMapKey } from '@/features/keuangan/gl-data'
import { keuanganRepository } from '@/features/keuangan/keuangan-storage'
import {
  berasQty,
  computeLotCost,
  nextBatchId,
  nextPackRunId,
  resolveLotIdFromBatch,
  sumPackRunOutQty,
  WIP_LOCATION,
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

function journalDateFromIso(iso: string): string {
  return iso.slice(0, 10)
}

function postPairJournal(
  postJournalEntry: ReturnType<typeof useFinanceStore>['postJournalEntry'],
  mapAccount: ReturnType<typeof useFinanceStore>['mapAccount'],
  input: {
    date: string
    memo: string
    sourceKey: string
    amount: number
    debitKey: AccountMapKey
    creditKey: AccountMapKey
    debitMemo?: string
    creditMemo?: string
  },
): string | undefined {
  const { amount, date, memo, sourceKey, debitKey, creditKey } = input
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  const debitId = mapAccount(debitKey)
  const creditId = mapAccount(creditKey)
  if (debitId === creditId) return undefined
  return postJournalEntry({
    date,
    memo,
    sourceKey,
    sourceType: 'auto',
    manual: false,
    lines: [
      {
        accountId: debitId,
        debit: amount,
        credit: 0,
        memo: input.debitMemo ?? memo,
      },
      {
        accountId: creditId,
        debit: 0,
        credit: amount,
        memo: input.creditMemo ?? memo,
      },
    ],
  })
}

function grainValueForBatch(batch: ProductionBatch): number {
  const lotId = resolveLotIdFromBatch(batch)
  if (!lotId) return 0
  const { purchases } = pembelianRepository.load()
  const purchase = purchases.find((p) => p.lotId === lotId && !p.voidedAt)
  if (!purchase) return 0
  return grainValueForPurchase(purchase)
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
  startBatch: (id: string) => string | undefined
  completeBatch: (id: string) => string | undefined
  voidBatch: (id: string, reason: string) => void
  deleteBatch: (id: string) => void
  createPackRun: (input: NewPackRunInput) => string
  updatePackRun: (id: string, lines: PackRunLine[]) => string | undefined
  postPackRun: (id: string) => DualTrackResult
  voidPackRun: (id: string) => string | undefined
  recalcLotCost: (batchId: string, opts: RecalcLotCostOptions) => string | undefined
}

const ProduksiContext = createContext<ProduksiContextValue | null>(null)

/** Legacy: gabah langsung dari sumber + output (batch tanpa WIP start). */
function postLegacyCompleteStock(
  batch: ProductionBatch,
  addMovement: ReturnType<typeof usePersediaanStore>['addMovement'],
  reverse: boolean,
) {
  const signNote = reverse ? 'Void' : 'Output'

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

  postBatchOutputStock(batch, addMovement, reverse, batch.processLocation, signNote)
}

function postStartWipStock(
  batch: ProductionBatch,
  addMovement: ReturnType<typeof usePersediaanStore>['addMovement'],
  reverse: boolean,
) {
  const signNote = reverse ? 'Void start' : 'Start WIP'
  if (reverse) {
    addMovement({
      type: 'out',
      sku: batch.inputSku,
      productName: batch.inputName,
      unit: batch.inputUnit,
      qty: batch.inputQty,
      fromLocation: WIP_LOCATION,
      toLocation: '—',
      note: `${signNote} ${batch.id} — tarik dari WIP`,
    })
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
      toLocation: WIP_LOCATION,
      note: `Start ${batch.id} — gabah ke WIP`,
    })
    addMovement({
      type: 'in',
      sku: batch.inputSku,
      productName: batch.inputName,
      unit: batch.inputUnit,
      qty: batch.inputQty,
      fromLocation: '—',
      toLocation: WIP_LOCATION,
      note: `Start ${batch.id} — gabah di WIP`,
    })
  }
}

function postBatchOutputStock(
  batch: ProductionBatch,
  addMovement: ReturnType<typeof usePersediaanStore>['addMovement'],
  reverse: boolean,
  fromLocation: string,
  signNote: string,
) {
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
        fromLocation,
        toLocation: batch.toLocation,
        note: `Output produksi ${batch.id}`,
      })
    }
  }
}

function postCompleteWipStock(
  batch: ProductionBatch,
  addMovement: ReturnType<typeof usePersediaanStore>['addMovement'],
  reverse: boolean,
) {
  const signNote = reverse ? 'Void' : 'Output'
  if (reverse) {
    postBatchOutputStock(batch, addMovement, true, WIP_LOCATION, signNote)
    addMovement({
      type: 'in',
      sku: batch.inputSku,
      productName: batch.inputName,
      unit: batch.inputUnit,
      qty: batch.inputQty,
      fromLocation: '—',
      toLocation: WIP_LOCATION,
      note: `${signNote} ${batch.id} — kembalikan ke WIP`,
    })
  } else {
    addMovement({
      type: 'out',
      sku: batch.inputSku,
      productName: batch.inputName,
      unit: batch.inputUnit,
      qty: batch.inputQty,
      fromLocation: WIP_LOCATION,
      toLocation: '—',
      note: `Complete ${batch.id} — konsumsi WIP`,
    })
    postBatchOutputStock(batch, addMovement, false, WIP_LOCATION, signNote)
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
  const { postJournalEntry, reverseJournalEntry, mapAccount } = useFinanceStore()
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
    (id: string): string | undefined => {
      const current = items.find((b) => b.id === id)
      if (!current || current.stage !== 'approved') return undefined
      if (current.wipStockPosted) return undefined

      const available = stockOnHand(stocks, current.inputSku, current.fromLocation)
      if (current.inputQty > available) return undefined

      postStartWipStock(current, addMovement, false)
      const wipGrainValue = grainValueForBatch(current)
      const startedAt = new Date().toISOString()
      const journalError = postPairJournal(postJournalEntry, mapAccount, {
        date: journalDateFromIso(startedAt),
        memo: `Start batch ${current.id}`,
        sourceKey: `batch:${current.id}:start`,
        amount: wipGrainValue,
        debitKey: 'wip',
        creditKey: 'inventoryGabah',
      })

      patch(
        id,
        () => ({
          ...current,
          stage: 'processing',
          startedAt,
          wipStockPosted: true,
          wipGrainValue,
        }),
        { action: 'start', note: 'Gabah ke WIP' },
      )
      return journalError
    },
    [items, stocks, addMovement, postJournalEntry, mapAccount, patch],
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
    (id: string): string | undefined => {
      const current = items.find((b) => b.id === id)
      if (!current) return undefined
      if (current.stage !== 'processing' && current.stage !== 'approved') {
        return undefined
      }
      if (current.inputQty <= 0 || !current.outputs.some((o) => o.qty > 0)) {
        return undefined
      }

      let journalError: string | undefined

      if (!current.stockPosted) {
        if (current.wipStockPosted) {
          postCompleteWipStock(current, addMovement, false)
        } else {
          postLegacyCompleteStock(current, addMovement, false)
        }
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

      // Done GL only after WIP start (Dr beras / Cr wip + ops). Legacy complete keeps stock only.
      if (doneBatch.wipStockPosted) {
        const wipGrain = doneBatch.wipGrainValue
        if (
          wipGrain != null &&
          Number.isFinite(wipGrain) &&
          wipGrain > 0
        ) {
          const lotId = resolveLotIdFromBatch(doneBatch)
          if (lotId) {
            const { purchases } = pembelianRepository.load()
            const purchase = purchases.find(
              (p) => p.lotId === lotId && !p.voidedAt,
            )
            if (purchase) {
              const allocatedOps = proportionalOpsForBatch(
                doneBatch,
                batchesForCosting,
              )
              const totalCost = wipGrain + allocatedOps
              const journalDate = journalDateFromIso(completedAt)
              const memo = `Complete batch ${doneBatch.id}`
              const lines = [
                {
                  accountId: mapAccount('inventoryBeras'),
                  debit: totalCost,
                  credit: 0,
                  memo,
                },
                {
                  accountId: mapAccount('wip'),
                  debit: 0,
                  credit: wipGrain,
                  memo: `${memo} — WIP grain`,
                },
              ]
              if (allocatedOps > 0) {
                lines.push({
                  accountId: mapAccount('mfgOverhead'),
                  debit: 0,
                  credit: allocatedOps,
                  memo: `${memo} — alokasi ops`,
                })
              }
              journalError = postJournalEntry({
                date: journalDate,
                memo,
                sourceKey: `batch:${doneBatch.id}:done`,
                sourceType: 'auto',
                manual: false,
                lines,
              })
            }
          }
        }
      }
      return journalError
    },
    [items, addMovement, patch, persistLotCostForBatch, postJournalEntry, mapAccount],
  )

  const voidBatch = useCallback(
    (id: string, reason: string) => {
      const current = items.find((b) => b.id === id)
      if (!current) return
      if (current.stage === 'void' || current.stage === 'draft') return

      if (current.stockPosted) {
        if (current.wipStockPosted) {
          postCompleteWipStock(current, addMovement, true)
        } else {
          postLegacyCompleteStock(current, addMovement, true)
        }
      } else if (current.wipStockPosted) {
        postStartWipStock(current, addMovement, true)
      }

      reverseJournalEntry({ sourceKey: `batch:${id}:done` })
      reverseJournalEntry({ sourceKey: `batch:${id}:start` })

      patch(
        id,
        (b) => ({
          ...b,
          stage: 'void',
          voidedAt: new Date().toISOString(),
          voidReason: reason || 'Dibatalkan',
          stockPosted: false,
          wipStockPosted: false,
          wipGrainValue: undefined,
        }),
        { action: 'void', note: reason },
      )
    },
    [items, addMovement, patch, reverseJournalEntry],
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
    (id: string): DualTrackResult => {
      if (!roleAllowed(user?.role, ['produksi', 'admin'])) {
        return {
          ok: false,
          error: 'Hanya produksi atau admin yang dapat memposting pack.',
        }
      }
      const current = packRuns.find((r) => r.id === id)
      if (!current) return { ok: false, error: 'Pack run tidak ditemukan.' }
      if (current.stage !== 'draft') {
        return { ok: false, error: 'Pack run sudah diposting.' }
      }
      if (current.voidedAt) {
        return { ok: false, error: 'Pack run sudah dibatalkan.' }
      }

      const batch = items.find((b) => b.id === current.batchId)
      if (!batch || batch.stage !== 'done') {
        return { ok: false, error: 'Batch produksi harus selesai (done).' }
      }
      const activeLines = current.lines.filter((l) => l.qty > 0)
      if (!activeLines.length) {
        return { ok: false, error: 'Minimal satu baris pack wajib qty > 0.' }
      }

      const toPost: PackRun = { ...current, lines: activeLines }
      const totalOut = sumPackRunOutQty(toPost)
      if (totalOut <= 0) {
        return { ok: false, error: 'Total qty pack tidak valid.' }
      }

      const available = stockOnHand(stocks, current.sourceSku, batch.toLocation)
      if (totalOut > available) {
        return {
          ok: false,
          error: `Stok ${current.sourceSku} di ${batch.toLocation} tidak cukup (tersedia ${available}).`,
        }
      }

      postPackStock(toPost, batch, addMovement, false)
      const postedAt = new Date().toISOString()
      const lotCost = lotCosts.find((c) => c.batchId === batch.id)
      const packAmount =
        lotCost && lotCost.costPerKgBeras > 0
          ? lotCost.costPerKgBeras * totalOut
          : 0
      const journalError = postPairJournal(postJournalEntry, mapAccount, {
        date: journalDateFromIso(postedAt),
        memo: `Pack ${toPost.id} · ${batch.id}`,
        sourceKey: `pack:${toPost.id}:post`,
        amount: packAmount,
        debitKey: 'inventoryBeras',
        creditKey: 'inventoryBeras',
        debitMemo: `Pack in · ${toPost.sourceSku}`,
        creditMemo: `Pack out · ${toPost.sourceSku}`,
      })
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
      return journalError ? { ok: true, journalError } : { ok: true }
    },
    [
      packRuns,
      items,
      stocks,
      lotCosts,
      addMovement,
      appendAudit,
      postJournalEntry,
      mapAccount,
      user?.role,
    ],
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
      reverseJournalEntry({ sourceKey: `pack:${id}:post` })
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
    [packRuns, items, stocks, addMovement, appendAudit, reverseJournalEntry, user?.role],
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
