import {
  DEFAULT_TAX_SETTINGS,
  type PpnRate,
  type PriceMode,
  type TaxDoc,
  type TaxInvoice,
  type TaxInvoiceStatus,
  type TaxSettings,
  type TaxSnapshot,
  type TaxSourceType,
} from '@/features/keuangan/tax-data'
import { getRelationalCache } from '@/lib/cloud-relational'
import { optNum, optStr, reqNum, reqStr } from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

const SETTINGS_ID = 'settings'

function parsePpnRate(raw: unknown, fallback: PpnRate): PpnRate {
  const n = optNum(raw)
  if (n === 0 || n === 11) return n
  return fallback
}

function parsePriceMode(raw: unknown): PriceMode {
  if (raw === 'exclusive' || raw === 'inclusive') return raw
  return 'exclusive'
}

function parseSourceType(raw: unknown): TaxSourceType {
  if (
    raw === 'sale' ||
    raw === 'purchase' ||
    raw === 'expense' ||
    raw === 'saleReturn' ||
    raw === 'purchaseReturn'
  ) {
    return raw
  }
  return 'sale'
}

function parseInvoiceStatus(raw: unknown): TaxInvoiceStatus {
  if (raw === 'draft' || raw === 'sent' || raw === 'failed' || raw === 'void') return raw
  return 'draft'
}

function settingsFromRow(row: Record<string, unknown>): TaxSettings {
  return {
    npwp: reqStr(row.npwp),
    invoicePrefix: reqStr(row.invoice_prefix),
    nextSeq: optNum(row.next_seq) ?? 1,
    defaultRate: parsePpnRate(row.default_rate, 11),
    defaultPriceMode: parsePriceMode(row.default_price_mode),
  }
}

function docFromRow(row: Record<string, unknown>): TaxDoc {
  const doc: TaxDoc = {
    id: reqStr(row.id),
    sourceType: parseSourceType(row.source_type),
    sourceId: reqStr(row.source_id),
    date: reqStr(row.date),
    ppnRate: parsePpnRate(row.ppn_rate, 0),
    priceMode: parsePriceMode(row.price_mode),
    dpp: reqNum(row.dpp),
    ppn: reqNum(row.ppn),
    total: reqNum(row.total),
    createdAt: reqStr(row.created_at_label),
  }
  const partyName = optStr(row.party_name)
  if (partyName) doc.partyName = partyName
  const note = optStr(row.note)
  if (note) doc.note = note
  const supplierFakturNo = optStr(row.supplier_faktur_no)
  if (supplierFakturNo) doc.supplierFakturNo = supplierFakturNo
  const voidedAt = optStr(row.voided_at)
  if (voidedAt) doc.voidedAt = voidedAt
  return doc
}

function invoiceFromRow(row: Record<string, unknown>): TaxInvoice {
  const invoice: TaxInvoice = {
    id: reqStr(row.id),
    number: reqStr(row.number),
    taxDocId: reqStr(row.tax_doc_id),
    saleOrderId: reqStr(row.sale_order_id),
    status: parseInvoiceStatus(row.status),
    dpp: reqNum(row.dpp),
    ppn: reqNum(row.ppn),
    total: reqNum(row.total),
    date: reqStr(row.date),
  }
  const sentAt = optStr(row.sent_at)
  if (sentAt) invoice.sentAt = sentAt
  const failReason = optStr(row.fail_reason)
  if (failReason) invoice.failReason = failReason
  const partyName = optStr(row.party_name)
  if (partyName) invoice.partyName = partyName
  return invoice
}

function settingsToRow(settings: TaxSettings): Record<string, unknown> {
  return {
    id: SETTINGS_ID,
    npwp: settings.npwp,
    invoice_prefix: settings.invoicePrefix,
    next_seq: settings.nextSeq,
    default_rate: settings.defaultRate,
    default_price_mode: settings.defaultPriceMode,
  }
}

function docToRow(doc: TaxDoc): Record<string, unknown> {
  return {
    id: doc.id,
    source_type: doc.sourceType,
    source_id: doc.sourceId,
    date: doc.date,
    ppn_rate: doc.ppnRate,
    price_mode: doc.priceMode,
    dpp: doc.dpp,
    ppn: doc.ppn,
    total: doc.total,
    party_name: doc.partyName ?? null,
    note: doc.note ?? null,
    supplier_faktur_no: doc.supplierFakturNo ?? null,
    created_at_label: doc.createdAt,
    voided_at: doc.voidedAt ?? null,
  }
}

function invoiceToRow(invoice: TaxInvoice): Record<string, unknown> {
  return {
    id: invoice.id,
    number: invoice.number,
    tax_doc_id: invoice.taxDocId,
    sale_order_id: invoice.saleOrderId,
    status: invoice.status,
    sent_at: invoice.sentAt ?? null,
    fail_reason: invoice.failReason ?? null,
    dpp: invoice.dpp,
    ppn: invoice.ppn,
    total: invoice.total,
    date: invoice.date,
    party_name: invoice.partyName ?? null,
  }
}

export function assembleTax(base: TaxSnapshot): TaxSnapshot | null {
  const settings = getRelationalCache('tax_settings')
  const docs = getRelationalCache('tax_docs')
  const invoices = getRelationalCache('tax_invoices')
  if (!settings || !docs || !invoices) return null

  const settingsRow = settings.find((row) => reqStr(row.id) === SETTINGS_ID) ?? settings[0]

  return {
    ...base,
    settings: settingsRow ? settingsFromRow(settingsRow) : { ...DEFAULT_TAX_SETTINGS },
    docs: docs.map(docFromRow),
    invoices: invoices.map(invoiceFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectTax(
  snap: TaxSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  return {
    tax_settings: [settingsToRow(snap.settings)],
    tax_docs: snap.docs.map(docToRow),
    tax_invoices: snap.invoices.map(invoiceToRow),
  }
}
