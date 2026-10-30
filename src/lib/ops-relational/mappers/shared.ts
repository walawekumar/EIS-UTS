import type { TaxSnapshotFields } from '@/features/keuangan/tax-data'
import type { ApprovalStamp } from '@/features/workflow/approvals'

const APPROVAL_ROLES: readonly ApprovalStamp['role'][] = [
  'admin',
  'keuangan',
  'pembelian',
  'penjualan',
  'produksi',
  'gudang',
]

export function optNum(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export function reqNum(raw: unknown): number {
  return optNum(raw) ?? 0
}

export function optStr(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined
  return raw
}

export function reqStr(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

export function reqBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase()
    return v === 'true' || v === 't' || v === '1'
  }
  return false
}

/** Null and unrecognized values stay unset so optional flags are not forced false. */
export function optBool(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase()
    if (v === 'true' || v === 't' || v === '1') return true
    if (v === 'false' || v === 'f' || v === '0') return false
  }
  return undefined
}

function isApprovalRole(raw: unknown): raw is ApprovalStamp['role'] {
  return APPROVAL_ROLES.some((role) => role === raw)
}

export function taxFromJson(raw: unknown): TaxSnapshotFields {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const t = raw as Record<string, unknown>
  const out: TaxSnapshotFields = {}
  if (t.ppnRate === 0 || t.ppnRate === 11) out.ppnRate = t.ppnRate
  if (t.priceMode === 'exclusive' || t.priceMode === 'inclusive') out.priceMode = t.priceMode
  const dpp = optNum(t.dpp)
  if (dpp != null) out.dpp = dpp
  const ppn = optNum(t.ppn)
  if (ppn != null) out.ppn = ppn
  const totalWithTax = optNum(t.totalWithTax)
  if (totalWithTax != null) out.totalWithTax = totalWithTax
  return out
}

export function taxToJson(fields: TaxSnapshotFields): Record<string, unknown> | null {
  const tax: Record<string, unknown> = {}
  if (fields.ppnRate === 0 || fields.ppnRate === 11) tax.ppnRate = fields.ppnRate
  if (fields.priceMode === 'exclusive' || fields.priceMode === 'inclusive') {
    tax.priceMode = fields.priceMode
  }
  if (fields.dpp != null && Number.isFinite(fields.dpp)) tax.dpp = fields.dpp
  if (fields.ppn != null && Number.isFinite(fields.ppn)) tax.ppn = fields.ppn
  if (fields.totalWithTax != null && Number.isFinite(fields.totalWithTax)) {
    tax.totalWithTax = fields.totalWithTax
  }
  return Object.keys(tax).length > 0 ? tax : null
}

export function approvalsFromJson(raw: unknown): ApprovalStamp[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const list: ApprovalStamp[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const a = item as Record<string, unknown>
    if (!isApprovalRole(a.role) || typeof a.by !== 'string' || typeof a.at !== 'string') continue
    const stamp: ApprovalStamp = { role: a.role, by: a.by, at: a.at }
    const note = optStr(a.note)
    if (note) stamp.note = note
    list.push(stamp)
  }
  return list.length > 0 ? list : undefined
}

export function approvalsToJson(list: ApprovalStamp[] | undefined): ApprovalStamp[] | null {
  if (!list?.length) return null
  return list.map((a) => {
    const stamp: ApprovalStamp = { role: a.role, by: a.by, at: a.at }
    if (a.note) stamp.note = a.note
    return stamp
  })
}

export function rowsByParent(
  rows: Record<string, unknown>[],
  parentKey: string,
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>()
  for (const row of rows) {
    const parentId = reqStr(row[parentKey])
    const list = map.get(parentId)
    if (list) list.push(row)
    else map.set(parentId, [row])
  }
  return map
}

/** 1-based suffix of `parentId-N`, matching ops_copy_child_id ordinals. */
function childOrdinal(parentId: string, rowId: string): number {
  const prefix = `${parentId}-`
  if (!rowId.startsWith(prefix)) return Number.POSITIVE_INFINITY
  if (!/^[1-9]\d*$/.test(rowId.slice(prefix.length))) return Number.POSITIVE_INFINITY
  const n = Number(rowId.slice(prefix.length))
  return Number.isSafeInteger(n) ? n : Number.POSITIVE_INFINITY
}

export function compareChildId(parentId: string, aId: string, bId: string): number {
  const ao = childOrdinal(parentId, aId)
  const bo = childOrdinal(parentId, bId)
  if (ao !== bo) return ao - bo
  if (aId < bId) return -1
  if (aId > bId) return 1
  return 0
}

/** Existing id, otherwise `parentId` + '-' + 1-based index (COPY convention). */
export function projectChildId(parentId: string, explicitId: string | undefined, index: number): string {
  if (explicitId) return explicitId
  return `${parentId}-${index + 1}`
}
