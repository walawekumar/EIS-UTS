import type {
  CorrectionRow,
  CorrectionStatus,
  MovementRow,
  MovementType,
  StockCategory,
  StockRow,
} from '@/features/persediaan/persediaan-data'

export type StockBalanceRow = {
  id: string
  sku: string
  name: string
  category: StockCategory
  location: string
  unit: string
  qty: number
  min_qty: number
  updated_at_label: string
}

export type StockMovementDbRow = {
  id: string
  date_label: string
  reference: string
  type: MovementType
  sku: string
  product_name: string
  from_location: string
  to_location: string
  qty: number
  unit: string
  note: string
  actor: string
  receipt_name: string
}

export type StockCorrectionDbRow = {
  id: string
  date_label: string
  reference: string
  sku: string
  product_name: string
  location: string
  before_qty: number
  after_qty: number
  unit: string
  reason: string
  status: CorrectionStatus
  actor: string
  receipt_name: string
}

export function stockFromRow(row: StockBalanceRow): StockRow {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    location: row.location,
    unit: row.unit,
    qty: Number(row.qty),
    minQty: Number(row.min_qty),
    updatedAt: row.updated_at_label,
  }
}

export function stockToRow(row: StockRow): StockBalanceRow {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    location: row.location,
    unit: row.unit,
    qty: row.qty,
    min_qty: row.minQty,
    updated_at_label: row.updatedAt,
  }
}

export function movementFromRow(row: StockMovementDbRow): MovementRow {
  return {
    id: row.id,
    date: row.date_label,
    reference: row.reference,
    type: row.type,
    sku: row.sku,
    productName: row.product_name,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    qty: Number(row.qty),
    unit: row.unit,
    note: row.note,
    actor: row.actor,
    receiptName: row.receipt_name || undefined,
  }
}

export function movementToRow(row: MovementRow): StockMovementDbRow {
  return {
    id: row.id,
    date_label: row.date,
    reference: row.reference,
    type: row.type,
    sku: row.sku,
    product_name: row.productName,
    from_location: row.fromLocation,
    to_location: row.toLocation,
    qty: row.qty,
    unit: row.unit,
    note: row.note,
    actor: row.actor,
    receipt_name: row.receiptName ?? '',
  }
}

export function correctionFromRow(row: StockCorrectionDbRow): CorrectionRow {
  return {
    id: row.id,
    date: row.date_label,
    reference: row.reference,
    sku: row.sku,
    productName: row.product_name,
    location: row.location,
    beforeQty: Number(row.before_qty),
    afterQty: Number(row.after_qty),
    unit: row.unit,
    reason: row.reason,
    status: row.status,
    actor: row.actor,
    receiptName: row.receipt_name || undefined,
  }
}

export function correctionToRow(row: CorrectionRow): StockCorrectionDbRow {
  return {
    id: row.id,
    date_label: row.date,
    reference: row.reference,
    sku: row.sku,
    product_name: row.productName,
    location: row.location,
    before_qty: row.beforeQty,
    after_qty: row.afterQty,
    unit: row.unit,
    reason: row.reason,
    status: row.status,
    actor: row.actor,
    receipt_name: row.receiptName ?? '',
  }
}
