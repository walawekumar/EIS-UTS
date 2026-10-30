export type PpnRate = 0 | 11
export type PriceMode = 'exclusive' | 'inclusive'

export type TaxSourceType =
  | 'sale'
  | 'purchase'
  | 'expense'
  | 'saleReturn'
  | 'purchaseReturn'

export type TaxDoc = {
  id: string
  sourceType: TaxSourceType
  sourceId: string
  date: string
  ppnRate: PpnRate
  priceMode: PriceMode
  dpp: number
  ppn: number
  total: number
  partyName?: string
  note?: string
  supplierFakturNo?: string
  createdAt: string
  voidedAt?: string
}

export type TaxInvoiceStatus = 'draft' | 'sent' | 'failed' | 'void'

export type TaxInvoice = {
  id: string
  number: string
  taxDocId: string
  saleOrderId: string
  status: TaxInvoiceStatus
  sentAt?: string
  failReason?: string
  dpp: number
  ppn: number
  total: number
  date: string
  partyName?: string
}

export type TaxSettings = {
  npwp: string
  invoicePrefix: string
  nextSeq: number
  defaultRate: PpnRate
  defaultPriceMode: PriceMode
}

/** Snapshot fields denormalized onto SO / PO / expense / return */
export type TaxSnapshotFields = {
  ppnRate?: PpnRate
  priceMode?: PriceMode
  dpp?: number
  ppn?: number
  totalWithTax?: number
}

export type TaxSnapshot = {
  version: 1
  settings: TaxSettings
  docs: TaxDoc[]
  invoices: TaxInvoice[]
  updatedAt: string
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  npwp: '',
  invoicePrefix: 'FP',
  nextSeq: 1,
  defaultRate: 11,
  defaultPriceMode: 'exclusive',
}
