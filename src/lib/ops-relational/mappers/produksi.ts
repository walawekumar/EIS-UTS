import type { ProduksiSnapshot } from '@/features/produksi/produksi-storage'
import {
  type BatchLine,
  type BatchStage,
  type LotCost,
  type PackRun,
  type PackRunLine,
  type ProductionBatch,
} from '@/features/produksi/produksi-data'
import { getRelationalCache } from '@/lib/cloud-relational'
import {
  compareChildId,
  optBool,
  optNum,
  optStr,
  projectChildId,
  reqBool,
  reqNum,
  reqStr,
  rowsByParent,
} from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

function parseBatchStage(raw: unknown): BatchStage {
  if (
    raw === 'draft' ||
    raw === 'submitted' ||
    raw === 'approved' ||
    raw === 'processing' ||
    raw === 'done' ||
    raw === 'rejected' ||
    raw === 'void'
  ) {
    return raw
  }
  return 'draft'
}

function parsePackStage(raw: unknown): PackRun['stage'] {
  if (raw === 'draft' || raw === 'posted') return raw
  return 'draft'
}

function parseKind(raw: unknown): BatchLine['kind'] {
  if (
    raw === 'beras' ||
    raw === 'menir' ||
    raw === 'dedak' ||
    raw === 'sekam' ||
    raw === 'lain'
  ) {
    return raw
  }
  return undefined
}

function parseGrade(raw: unknown): PackRunLine['grade'] {
  if (raw === 'A' || raw === 'B' || raw === 'C') return raw
  return undefined
}

function parseLotMethod(raw: unknown): LotCost['method'] {
  if (raw === 'manual' || raw === 'proportional') return raw
  return 'manual'
}

function outputFromRow(r: Record<string, unknown>): BatchLine {
  const line: BatchLine = {
    sku: reqStr(r.sku),
    productName: reqStr(r.product_name),
    unit: reqStr(r.unit),
    qty: reqNum(r.qty),
  }
  const kind = parseKind(r.kind)
  if (kind) line.kind = kind
  return line
}

function batchFromRow(row: Record<string, unknown>, outputs: BatchLine[]): ProductionBatch {
  const batch: ProductionBatch = {
    id: reqStr(row.id),
    date: reqStr(row.date),
    operator: reqStr(row.operator),
    stage: parseBatchStage(row.stage),
    inputSku: reqStr(row.input_sku),
    inputName: reqStr(row.input_name),
    inputUnit: reqStr(row.input_unit),
    inputQty: reqNum(row.input_qty),
    fromLocation: reqStr(row.from_location),
    processLocation: reqStr(row.process_location),
    toLocation: reqStr(row.to_location),
    outputs,
    targetRendemen: reqNum(row.target_rendemen),
    note: reqStr(row.note),
    stockPosted: reqBool(row.stock_posted),
  }
  const inputLotId = optStr(row.input_lot_id)
  if (inputLotId) batch.inputLotId = inputLotId
  const submittedAt = optStr(row.submitted_at)
  if (submittedAt) batch.submittedAt = submittedAt
  const approvedAt = optStr(row.approved_at)
  if (approvedAt) batch.approvedAt = approvedAt
  const approvedBy = optStr(row.approved_by)
  if (approvedBy) batch.approvedBy = approvedBy
  const rejectedAt = optStr(row.rejected_at)
  if (rejectedAt) batch.rejectedAt = rejectedAt
  const rejectReason = optStr(row.reject_reason)
  if (rejectReason) batch.rejectReason = rejectReason
  const startedAt = optStr(row.started_at)
  if (startedAt) batch.startedAt = startedAt
  const completedAt = optStr(row.completed_at)
  if (completedAt) batch.completedAt = completedAt
  const voidedAt = optStr(row.voided_at)
  if (voidedAt) batch.voidedAt = voidedAt
  const voidReason = optStr(row.void_reason)
  if (voidReason) batch.voidReason = voidReason
  const wipStockPosted = optBool(row.wip_stock_posted)
  if (wipStockPosted !== undefined) batch.wipStockPosted = wipStockPosted
  const wipGrainValue = optNum(row.wip_grain_value)
  if (wipGrainValue != null) batch.wipGrainValue = wipGrainValue
  return batch
}

function packLineFromRow(r: Record<string, unknown>): PackRunLine {
  const line: PackRunLine = {
    sku: reqStr(r.sku),
    productName: reqStr(r.product_name),
    unit: reqStr(r.unit),
    qty: reqNum(r.qty),
    location: reqStr(r.location),
  }
  const grade = parseGrade(r.grade)
  if (grade) line.grade = grade
  const bags = optNum(r.bags)
  if (bags != null) line.bags = bags
  return line
}

function packRunFromRow(row: Record<string, unknown>, lines: PackRunLine[]): PackRun {
  const run: PackRun = {
    id: reqStr(row.id),
    batchId: reqStr(row.batch_id),
    sourceSku: reqStr(row.source_sku),
    lines,
    stage: parsePackStage(row.stage),
    createdAt: reqStr(row.created_at_label),
  }
  const postedAt = optStr(row.posted_at)
  if (postedAt) run.postedAt = postedAt
  const voidedAt = optStr(row.voided_at)
  if (voidedAt) run.voidedAt = voidedAt
  return run
}

function lotCostFromRow(row: Record<string, unknown>): LotCost {
  return {
    lotId: optStr(row.lot_id) ?? optStr(row.id) ?? '',
    batchId: reqStr(row.batch_id),
    grainValue: reqNum(row.grain_value),
    allocatedOps: reqNum(row.allocated_ops),
    berasQty: reqNum(row.beras_qty),
    costPerKgBeras: reqNum(row.cost_per_kg_beras),
    method: parseLotMethod(row.method),
    at: reqStr(row.at),
  }
}

function batchToRow(batch: ProductionBatch): Record<string, unknown> {
  return {
    id: batch.id,
    date: batch.date,
    operator: batch.operator,
    stage: batch.stage,
    input_sku: batch.inputSku,
    input_name: batch.inputName,
    input_unit: batch.inputUnit,
    input_qty: batch.inputQty,
    input_lot_id: batch.inputLotId ?? null,
    from_location: batch.fromLocation,
    process_location: batch.processLocation,
    to_location: batch.toLocation,
    target_rendemen: batch.targetRendemen,
    note: batch.note,
    submitted_at: batch.submittedAt ?? null,
    approved_at: batch.approvedAt ?? null,
    approved_by: batch.approvedBy ?? null,
    rejected_at: batch.rejectedAt ?? null,
    reject_reason: batch.rejectReason ?? null,
    started_at: batch.startedAt ?? null,
    completed_at: batch.completedAt ?? null,
    voided_at: batch.voidedAt ?? null,
    void_reason: batch.voidReason ?? null,
    stock_posted: batch.stockPosted,
    wip_stock_posted: batch.wipStockPosted ?? null,
    wip_grain_value: batch.wipGrainValue ?? null,
  }
}

function outputToRow(batchId: string, line: BatchLine, index: number): Record<string, unknown> {
  return {
    id: projectChildId(batchId, undefined, index),
    batch_id: batchId,
    sku: line.sku,
    product_name: line.productName,
    unit: line.unit,
    qty: line.qty,
    kind: line.kind ?? null,
  }
}

function packRunToRow(run: PackRun): Record<string, unknown> {
  return {
    id: run.id,
    batch_id: run.batchId,
    source_sku: run.sourceSku,
    stage: run.stage,
    created_at_label: run.createdAt,
    posted_at: run.postedAt ?? null,
    voided_at: run.voidedAt ?? null,
  }
}

function packLineToRow(packRunId: string, line: PackRunLine, index: number): Record<string, unknown> {
  return {
    id: projectChildId(packRunId, undefined, index),
    pack_run_id: packRunId,
    sku: line.sku,
    product_name: line.productName,
    unit: line.unit,
    grade: line.grade ?? null,
    qty: line.qty,
    bags: line.bags ?? null,
    location: line.location,
  }
}

function lotCostToRow(cost: LotCost): Record<string, unknown> {
  return {
    id: cost.lotId,
    lot_id: cost.lotId,
    batch_id: cost.batchId,
    grain_value: cost.grainValue,
    allocated_ops: cost.allocatedOps,
    beras_qty: cost.berasQty,
    cost_per_kg_beras: cost.costPerKgBeras,
    method: cost.method,
    at: cost.at,
  }
}

export function assembleProduksi(base: ProduksiSnapshot): ProduksiSnapshot | null {
  const batches = getRelationalCache('production_batches')
  const outputs = getRelationalCache('batch_outputs')
  const packRuns = getRelationalCache('pack_runs')
  const packLines = getRelationalCache('pack_run_lines')
  const lotCosts = getRelationalCache('lot_costs')
  if (!batches || !outputs || !packRuns || !packLines || !lotCosts) return null

  const outputsByBatch = rowsByParent(outputs, 'batch_id')
  const linesByRun = rowsByParent(packLines, 'pack_run_id')

  const batchDocs = batches.map((row) => {
    const id = reqStr(row.id)
    const outputRows = (outputsByBatch.get(id) ?? [])
      .slice()
      .sort((a, b) => compareChildId(id, reqStr(a.id), reqStr(b.id)))
    return batchFromRow(row, outputRows.map(outputFromRow))
  })

  const packDocs = packRuns.map((row) => {
    const id = reqStr(row.id)
    const lineRows = (linesByRun.get(id) ?? [])
      .slice()
      .sort((a, b) => compareChildId(id, reqStr(a.id), reqStr(b.id)))
    return packRunFromRow(row, lineRows.map(packLineFromRow))
  })

  return {
    ...base,
    batches: batchDocs,
    packRuns: packDocs,
    lotCosts: lotCosts.map(lotCostFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectProduksi(
  snap: ProduksiSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  const batchRows: Record<string, unknown>[] = []
  const outputRows: Record<string, unknown>[] = []
  for (const batch of snap.batches) {
    batchRows.push(batchToRow(batch))
    for (let i = 0; i < batch.outputs.length; i++) {
      outputRows.push(outputToRow(batch.id, batch.outputs[i], i))
    }
  }

  const packRows: Record<string, unknown>[] = []
  const packLineRows: Record<string, unknown>[] = []
  for (const run of snap.packRuns) {
    packRows.push(packRunToRow(run))
    for (let i = 0; i < run.lines.length; i++) {
      packLineRows.push(packLineToRow(run.id, run.lines[i], i))
    }
  }

  return {
    production_batches: batchRows,
    batch_outputs: outputRows,
    pack_runs: packRows,
    pack_run_lines: packLineRows,
    lot_costs: snap.lotCosts.map(lotCostToRow),
  }
}
