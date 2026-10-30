import {
  migratePurchaseStage,
  type GrainType,
  type LotQc,
  type LotQcGrade,
  type Payment,
  type PaymentMethod,
  type Purchase,
  type PurchaseReturn,
  type PurchaseReturnLine,
  type Weighing,
} from '@/features/pembelian/pembelian-data'
import type { PembelianSnapshot } from '@/features/pembelian/pembelian-storage'
import { migrateReturnStage } from '@/features/workflow/doc-stages'
import type { ProofAttachment } from '@/features/workflow/proof'
import { getRelationalCache } from '@/lib/cloud-relational'
import {
  approvalsFromJson,
  approvalsToJson,
  compareChildId,
  optNum,
  optStr,
  projectChildId,
  reqBool,
  reqNum,
  reqStr,
  rowsByParent,
  taxFromJson,
  taxToJson,
} from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

function parseGrain(raw: unknown): GrainType {
  if (raw === 'GKP' || raw === 'GKG') return raw
  return 'GKP'
}

function parseMethod(raw: unknown): PaymentMethod {
  if (raw === 'tunai' || raw === 'transfer') return raw
  return 'tunai'
}

function parseGrade(raw: unknown): LotQcGrade {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'reject') return raw
  return 'C'
}

function proofFromJson(raw: unknown): ProofAttachment | string | undefined {
  if (typeof raw === 'string') return raw === '' ? undefined : raw
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name : ''
  const size = optNum(o.size)
  const mime = optStr(o.mime)
  const previewUrl = optStr(o.previewUrl)
  if (!name && size == null && !mime && !previewUrl) return undefined
  const proof: ProofAttachment = { name }
  if (size != null) proof.size = size
  if (mime) proof.mime = mime
  if (previewUrl) proof.previewUrl = previewUrl
  return proof
}

function proofToJson(
  proof: ProofAttachment | string | undefined,
): ProofAttachment | string | null {
  if (proof == null) return null
  if (typeof proof === 'string') return proof === '' ? null : proof
  const out: ProofAttachment = { name: proof.name }
  if (proof.size != null && Number.isFinite(proof.size)) out.size = proof.size
  if (proof.mime) out.mime = proof.mime
  if (proof.previewUrl) out.previewUrl = proof.previewUrl
  return out
}

function weighingFromJson(raw: unknown): Weighing | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const w = raw as Record<string, unknown>
  const hasCore =
    w.bruto != null ||
    w.tara != null ||
    w.moisture != null ||
    w.impurity != null ||
    typeof w.weighedAt === 'string' ||
    typeof w.confirmedAt === 'string' ||
    typeof w.receiptName === 'string'
  if (!hasCore) return undefined
  const weighing: Weighing = {
    bruto: reqNum(w.bruto),
    tara: reqNum(w.tara),
    moisture: reqNum(w.moisture),
    impurity: reqNum(w.impurity),
    weighedAt: typeof w.weighedAt === 'string' ? w.weighedAt : '',
  }
  const confirmedAt = optStr(w.confirmedAt)
  if (confirmedAt) weighing.confirmedAt = confirmedAt
  const receiptName = optStr(w.receiptName)
  if (receiptName) weighing.receiptName = receiptName
  return weighing
}

function weighingToJson(w: Weighing | undefined): Record<string, unknown> | null {
  if (!w) return null
  const row: Record<string, unknown> = {
    bruto: w.bruto,
    tara: w.tara,
    moisture: w.moisture,
    impurity: w.impurity,
    weighedAt: w.weighedAt,
  }
  if (w.confirmedAt) row.confirmedAt = w.confirmedAt
  if (w.receiptName) row.receiptName = w.receiptName
  return row
}

function paymentFromRow(r: Record<string, unknown>): Payment {
  const payment: Payment = {
    id: reqStr(r.id),
    date: reqStr(r.date),
    amount: reqNum(r.amount),
    method: parseMethod(r.method),
  }
  const receiptName = optStr(r.receipt_name)
  if (receiptName) payment.receiptName = receiptName
  const transferProof = proofFromJson(r.transfer_proof)
  if (transferProof !== undefined) payment.transferProof = transferProof
  return payment
}

function purchaseFromRow(row: Record<string, unknown>, payments: Payment[]): Purchase {
  const purchase: Purchase = {
    id: reqStr(row.id),
    date: reqStr(row.date),
    supplierId: reqStr(row.supplier_id),
    grain: parseGrain(row.grain),
    sacks: reqNum(row.sacks),
    estimatedKg: reqNum(row.estimated_kg),
    price: reqNum(row.price),
    stage: migratePurchaseStage(reqStr(row.stage)),
    payments,
    ...taxFromJson(row.tax),
  }
  const effectivePrice = optNum(row.effective_price)
  if (effectivePrice != null) purchase.effectivePrice = effectivePrice
  const lotId = optStr(row.lot_id)
  if (lotId) purchase.lotId = lotId
  const vehicle = optStr(row.vehicle)
  if (vehicle) purchase.vehicle = vehicle
  const note = optStr(row.note)
  if (note) purchase.note = note
  const weighing = weighingFromJson(row.weighing)
  if (weighing) purchase.weighing = weighing
  const dueDate = optStr(row.due_date)
  if (dueDate) purchase.dueDate = dueDate
  const invoiceProof = proofFromJson(row.invoice_proof)
  if (invoiceProof !== undefined) purchase.invoiceProof = invoiceProof
  const purchaseProof = proofFromJson(row.purchase_proof)
  if (purchaseProof !== undefined) purchase.purchaseProof = purchaseProof
  const approvals = approvalsFromJson(row.approvals)
  if (approvals) purchase.approvals = approvals
  const rejectReason = optStr(row.reject_reason)
  if (rejectReason) purchase.rejectReason = rejectReason
  const budgetApprovedAt = optStr(row.budget_approved_at)
  if (budgetApprovedAt) purchase.budgetApprovedAt = budgetApprovedAt
  const completedAt = optStr(row.completed_at)
  if (completedAt) purchase.completedAt = completedAt
  const voidedAt = optStr(row.voided_at)
  if (voidedAt) purchase.voidedAt = voidedAt
  const voidReason = optStr(row.void_reason)
  if (voidReason) purchase.voidReason = voidReason
  return purchase
}

function lineFromRow(r: Record<string, unknown>): PurchaseReturnLine {
  return {
    sku: reqStr(r.sku),
    productName: reqStr(r.product_name),
    unit: typeof r.unit === 'string' ? r.unit : 'kg',
    qty: reqNum(r.qty),
  }
}

function returnFromRow(row: Record<string, unknown>, lines: PurchaseReturnLine[]): PurchaseReturn {
  const doc: PurchaseReturn = {
    id: reqStr(row.id),
    purchaseId: reqStr(row.purchase_id),
    lines,
    reason: reqStr(row.reason),
    stage: migrateReturnStage(reqStr(row.stage)),
    createdAt: reqStr(row.created_at_label),
    ...taxFromJson(row.tax),
  }
  const lotId = optStr(row.lot_id)
  if (lotId) doc.lotId = lotId
  const approvals = approvalsFromJson(row.approvals)
  if (approvals) doc.approvals = approvals
  const postedAt = optStr(row.posted_at)
  if (postedAt) doc.postedAt = postedAt
  const rejectedReason = optStr(row.rejected_reason)
  if (rejectedReason) doc.rejectedReason = rejectedReason
  return doc
}

function lotQcFromRow(row: Record<string, unknown>): LotQc {
  const qc: LotQc = {
    lotId: optStr(row.lot_id) ?? optStr(row.id) ?? '',
    purchaseId: reqStr(row.purchase_id),
    moisture: reqNum(row.moisture),
    impurity: reqNum(row.impurity),
    brokenPct: reqNum(row.broken_pct),
    grade: parseGrade(row.grade),
    passed: reqBool(row.passed),
    by: reqStr(row.by_actor),
    at: reqStr(row.at),
  }
  const note = optStr(row.note)
  if (note) qc.note = note
  const overrideReason = optStr(row.override_reason)
  if (overrideReason) qc.overrideReason = overrideReason
  return qc
}

function purchaseToRow(p: Purchase): Record<string, unknown> {
  return {
    id: p.id,
    date: p.date,
    supplier_id: p.supplierId,
    grain: p.grain,
    sacks: p.sacks,
    estimated_kg: p.estimatedKg,
    price: p.price,
    effective_price: p.effectivePrice ?? null,
    lot_id: p.lotId ?? null,
    vehicle: p.vehicle ?? null,
    note: p.note ?? null,
    stage: p.stage,
    weighing: weighingToJson(p.weighing),
    due_date: p.dueDate ?? null,
    invoice_proof: proofToJson(p.invoiceProof),
    purchase_proof: proofToJson(p.purchaseProof),
    approvals: approvalsToJson(p.approvals),
    reject_reason: p.rejectReason ?? null,
    budget_approved_at: p.budgetApprovedAt ?? null,
    completed_at: p.completedAt ?? null,
    voided_at: p.voidedAt ?? null,
    void_reason: p.voidReason ?? null,
    tax: taxToJson(p),
  }
}

function paymentToRow(purchaseId: string, pay: Payment, index: number): Record<string, unknown> {
  return {
    id: projectChildId(purchaseId, pay.id, index),
    purchase_id: purchaseId,
    date: pay.date,
    amount: pay.amount,
    method: pay.method,
    receipt_name: pay.receiptName ?? null,
    transfer_proof: proofToJson(pay.transferProof),
  }
}

function returnToRow(doc: PurchaseReturn): Record<string, unknown> {
  return {
    id: doc.id,
    purchase_id: doc.purchaseId,
    lot_id: doc.lotId ?? null,
    reason: doc.reason,
    stage: doc.stage,
    approvals: approvalsToJson(doc.approvals),
    posted_at: doc.postedAt ?? null,
    rejected_reason: doc.rejectedReason ?? null,
    created_at_label: doc.createdAt,
    tax: taxToJson(doc),
  }
}

function returnLineToRow(
  returnId: string,
  line: PurchaseReturnLine,
  index: number,
): Record<string, unknown> {
  return {
    id: projectChildId(returnId, undefined, index),
    return_id: returnId,
    sku: line.sku,
    product_name: line.productName,
    unit: line.unit,
    qty: line.qty,
  }
}

function lotQcToRow(qc: LotQc): Record<string, unknown> {
  return {
    id: qc.lotId,
    lot_id: qc.lotId,
    purchase_id: qc.purchaseId,
    moisture: qc.moisture,
    impurity: qc.impurity,
    broken_pct: qc.brokenPct,
    grade: qc.grade,
    passed: qc.passed,
    note: qc.note ?? null,
    by_actor: qc.by,
    at: qc.at,
    override_reason: qc.overrideReason ?? null,
  }
}

export function assemblePembelian(base: PembelianSnapshot): PembelianSnapshot | null {
  const purchases = getRelationalCache('purchases')
  const payments = getRelationalCache('purchase_payments')
  const returns = getRelationalCache('purchase_returns')
  const returnLines = getRelationalCache('purchase_return_lines')
  const lotQc = getRelationalCache('lot_qc')
  if (!purchases || !payments || !returns || !returnLines || !lotQc) return null

  const paysByPurchase = rowsByParent(payments, 'purchase_id')
  const linesByReturn = rowsByParent(returnLines, 'return_id')

  const purchaseDocs = purchases.map((row) => {
    const id = reqStr(row.id)
    const payRows = (paysByPurchase.get(id) ?? [])
      .slice()
      .sort((a, b) => compareChildId(id, reqStr(a.id), reqStr(b.id)))
    return purchaseFromRow(row, payRows.map(paymentFromRow))
  })

  const returnDocs = returns.map((row) => {
    const id = reqStr(row.id)
    const lineRows = (linesByReturn.get(id) ?? [])
      .slice()
      .sort((a, b) => compareChildId(id, reqStr(a.id), reqStr(b.id)))
    return returnFromRow(row, lineRows.map(lineFromRow))
  })

  return {
    ...base,
    purchases: purchaseDocs,
    returns: returnDocs,
    lotQc: lotQc.map(lotQcFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectPembelian(
  snap: PembelianSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  const purchaseRows: Record<string, unknown>[] = []
  const paymentRows: Record<string, unknown>[] = []
  for (const p of snap.purchases) {
    purchaseRows.push(purchaseToRow(p))
    for (let i = 0; i < p.payments.length; i++) {
      paymentRows.push(paymentToRow(p.id, p.payments[i], i))
    }
  }

  const returnRows: Record<string, unknown>[] = []
  const returnLineRows: Record<string, unknown>[] = []
  for (const doc of snap.returns) {
    returnRows.push(returnToRow(doc))
    for (let i = 0; i < doc.lines.length; i++) {
      returnLineRows.push(returnLineToRow(doc.id, doc.lines[i], i))
    }
  }

  return {
    purchases: purchaseRows,
    purchase_payments: paymentRows,
    purchase_returns: returnRows,
    purchase_return_lines: returnLineRows,
    lot_qc: snap.lotQc.map(lotQcToRow),
  }
}
