import type { PenjualanSnapshot } from '@/features/penjualan/penjualan-storage'
import {
  type Delivery,
  type OrderStage,
  type Payment,
  type PaymentMethod,
  type SaleOrder,
  type SaleReturn,
  type SaleReturnLine,
  type SettlementMode,
} from '@/features/penjualan/penjualan-data'
import { migrateReturnStage } from '@/features/workflow/doc-stages'
import { getRelationalCache } from '@/lib/cloud-relational'
import {
  approvalsFromJson,
  approvalsToJson,
  compareChildId,
  optStr,
  projectChildId,
  reqNum,
  reqStr,
  rowsByParent,
  taxFromJson,
  taxToJson,
} from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

function parseOrderStage(raw: unknown): OrderStage {
  if (raw === 'dibuat' || raw === 'dikirim') return raw
  return 'dibuat'
}

function parseMethod(raw: unknown): PaymentMethod {
  if (raw === 'tunai' || raw === 'transfer') return raw
  return 'tunai'
}

function parseSettlement(raw: unknown): SettlementMode {
  if (raw === 'lunas' || raw === 'kredit') return raw
  return 'kredit'
}

function deliveryFromJson(raw: unknown): Delivery | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const d = raw as Record<string, unknown>
  const shippedAt = typeof d.shippedAt === 'string' ? d.shippedAt : ''
  const hasCore =
    shippedAt !== '' ||
    d.settlement != null ||
    typeof d.vehicle === 'string' ||
    typeof d.driver === 'string' ||
    typeof d.note === 'string' ||
    typeof d.receiptName === 'string' ||
    d.payMethod != null ||
    typeof d.payReceiptName === 'string'
  if (!hasCore) return undefined
  const delivery: Delivery = {
    shippedAt,
    settlement: parseSettlement(d.settlement),
  }
  const vehicle = optStr(d.vehicle)
  if (vehicle) delivery.vehicle = vehicle
  const driver = optStr(d.driver)
  if (driver) delivery.driver = driver
  const note = optStr(d.note)
  if (note) delivery.note = note
  const receiptName = optStr(d.receiptName)
  if (receiptName) delivery.receiptName = receiptName
  if (d.payMethod === 'tunai' || d.payMethod === 'transfer') delivery.payMethod = d.payMethod
  const payReceiptName = optStr(d.payReceiptName)
  if (payReceiptName) delivery.payReceiptName = payReceiptName
  return delivery
}

function deliveryToJson(delivery: Delivery | undefined): Record<string, unknown> | null {
  if (!delivery) return null
  const row: Record<string, unknown> = {
    shippedAt: delivery.shippedAt,
    settlement: delivery.settlement,
  }
  if (delivery.vehicle) row.vehicle = delivery.vehicle
  if (delivery.driver) row.driver = delivery.driver
  if (delivery.note) row.note = delivery.note
  if (delivery.receiptName) row.receiptName = delivery.receiptName
  if (delivery.payMethod) row.payMethod = delivery.payMethod
  if (delivery.payReceiptName) row.payReceiptName = delivery.payReceiptName
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
  return payment
}

function orderFromRow(row: Record<string, unknown>, payments: Payment[]): SaleOrder {
  const order: SaleOrder = {
    id: reqStr(row.id),
    date: reqStr(row.date),
    customerId: reqStr(row.customer_id),
    sku: reqStr(row.sku),
    productName: reqStr(row.product_name),
    unit: reqStr(row.unit),
    qty: reqNum(row.qty),
    price: reqNum(row.price),
    stage: parseOrderStage(row.stage),
    payments,
    ...taxFromJson(row.tax),
  }
  const note = optStr(row.note)
  if (note) order.note = note
  const delivery = deliveryFromJson(row.delivery)
  if (delivery) order.delivery = delivery
  const dueDate = optStr(row.due_date)
  if (dueDate) order.dueDate = dueDate
  const lotId = optStr(row.lot_id)
  if (lotId) order.lotId = lotId
  const voidedAt = optStr(row.voided_at)
  if (voidedAt) order.voidedAt = voidedAt
  const voidReason = optStr(row.void_reason)
  if (voidReason) order.voidReason = voidReason
  return order
}

function lineFromRow(r: Record<string, unknown>): SaleReturnLine {
  return {
    sku: reqStr(r.sku),
    productName: reqStr(r.product_name),
    unit: typeof r.unit === 'string' ? r.unit : 'kg',
    qty: reqNum(r.qty),
  }
}

function returnFromRow(row: Record<string, unknown>, lines: SaleReturnLine[]): SaleReturn {
  const doc: SaleReturn = {
    id: reqStr(row.id),
    orderId: reqStr(row.order_id),
    lines,
    reason: reqStr(row.reason),
    stage: migrateReturnStage(reqStr(row.stage)),
    createdAt: reqStr(row.created_at_label),
    ...taxFromJson(row.tax),
  }
  const approvals = approvalsFromJson(row.approvals)
  if (approvals) doc.approvals = approvals
  const postedAt = optStr(row.posted_at)
  if (postedAt) doc.postedAt = postedAt
  const rejectedReason = optStr(row.rejected_reason)
  if (rejectedReason) doc.rejectedReason = rejectedReason
  return doc
}

function orderToRow(order: SaleOrder): Record<string, unknown> {
  return {
    id: order.id,
    date: order.date,
    customer_id: order.customerId,
    sku: order.sku,
    product_name: order.productName,
    unit: order.unit,
    qty: order.qty,
    price: order.price,
    note: order.note ?? null,
    stage: order.stage,
    delivery: deliveryToJson(order.delivery),
    due_date: order.dueDate ?? null,
    lot_id: order.lotId ?? null,
    voided_at: order.voidedAt ?? null,
    void_reason: order.voidReason ?? null,
    tax: taxToJson(order),
  }
}

function paymentToRow(orderId: string, pay: Payment, index: number): Record<string, unknown> {
  return {
    id: projectChildId(orderId, pay.id, index),
    order_id: orderId,
    date: pay.date,
    amount: pay.amount,
    method: pay.method,
    receipt_name: pay.receiptName ?? null,
  }
}

function returnToRow(doc: SaleReturn): Record<string, unknown> {
  return {
    id: doc.id,
    order_id: doc.orderId,
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
  line: SaleReturnLine,
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

export function assemblePenjualan(base: PenjualanSnapshot): PenjualanSnapshot | null {
  const orders = getRelationalCache('sale_orders')
  const payments = getRelationalCache('sale_order_payments')
  const returns = getRelationalCache('sale_returns')
  const returnLines = getRelationalCache('sale_return_lines')
  if (!orders || !payments || !returns || !returnLines) return null

  const paysByOrder = rowsByParent(payments, 'order_id')
  const linesByReturn = rowsByParent(returnLines, 'return_id')

  const orderDocs = orders.map((row) => {
    const id = reqStr(row.id)
    const payRows = (paysByOrder.get(id) ?? [])
      .slice()
      .sort((a, b) => compareChildId(id, reqStr(a.id), reqStr(b.id)))
    return orderFromRow(row, payRows.map(paymentFromRow))
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
    orders: orderDocs,
    returns: returnDocs,
    updatedAt: new Date().toISOString(),
  }
}

export function projectPenjualan(
  snap: PenjualanSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  const orderRows: Record<string, unknown>[] = []
  const paymentRows: Record<string, unknown>[] = []
  for (const order of snap.orders) {
    orderRows.push(orderToRow(order))
    for (let i = 0; i < order.payments.length; i++) {
      paymentRows.push(paymentToRow(order.id, order.payments[i], i))
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
    sale_orders: orderRows,
    sale_order_payments: paymentRows,
    sale_returns: returnRows,
    sale_return_lines: returnLineRows,
  }
}
