// src/features/keuangan/gl-data.ts
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export type Account = {
  id: string
  code: string
  name: string
  type: AccountType
  parentId?: string
  isPostable: boolean
  active: boolean
  system: boolean
}

export type AccountMapKey =
  | 'cash'
  | 'ap'
  | 'ar'
  | 'inventoryGabah'
  | 'inventoryBeras'
  | 'wip'
  | 'cogs'
  | 'sales'
  | 'salesReturn'
  | 'expenseOps'
  | 'payroll'
  | 'mfgOverhead'
  | 'openingEquity'
  | 'ppnOut'
  | 'ppnIn'

export type AccountMap = Record<AccountMapKey, string> // accountId

export type JournalLine = {
  accountId: string
  debit: number
  credit: number
  memo?: string
}

export type JournalSourceType = 'auto' | 'manual' | 'opening' | 'reverse'

export type JournalEntry = {
  id: string
  date: string // YYYY-MM-DD
  memo: string
  sourceKey?: string
  sourceType: JournalSourceType
  manual: boolean
  lines: JournalLine[]
  createdBy: string
  createdAt: string
  voidedAt?: string
  reversesId?: string
  reversedById?: string
}

export type FailedJournalPost = {
  sourceKey: string
  payload: Omit<JournalEntry, 'id' | 'createdAt' | 'voidedAt' | 'reversedById'>
  error: string
  createdAt: string
}

export type GlSnapshot = {
  version: 1
  accounts: Account[]
  accountMap: AccountMap
  journals: JournalEntry[]
  failedPosts: FailedJournalPost[]
  updatedAt: string
}

/** Seed UMKM penggilingan — ids stable for DEFAULT_ACCOUNT_MAP */
export const SEED_ACCOUNTS: Account[] = [
  { id: 'acc-cash', code: '1-1100', name: 'Kas & Bank', type: 'asset', isPostable: true, active: true, system: true },
  { id: 'acc-ar', code: '1-1200', name: 'Piutang Usaha', type: 'asset', isPostable: true, active: true, system: true },
  { id: 'acc-inv-gabah', code: '1-1300', name: 'Persediaan Gabah', type: 'asset', isPostable: true, active: true, system: true },
  { id: 'acc-wip', code: '1-1350', name: 'Persediaan WIP', type: 'asset', isPostable: true, active: true, system: true },
  { id: 'acc-inv-beras', code: '1-1400', name: 'Persediaan Beras', type: 'asset', isPostable: true, active: true, system: true },
  { id: 'acc-ap', code: '2-1100', name: 'Utang Usaha', type: 'liability', isPostable: true, active: true, system: true },
  { id: 'acc-ppn-out', code: '2-1200', name: 'PPN Keluaran', type: 'liability', isPostable: true, active: true, system: true },
  { id: 'acc-ppn-in', code: '1-1500', name: 'PPN Masukan', type: 'asset', isPostable: true, active: true, system: true },
  { id: 'acc-equity', code: '3-1100', name: 'Modal / Saldo Awal', type: 'equity', isPostable: true, active: true, system: true },
  { id: 'acc-sales', code: '4-1100', name: 'Penjualan', type: 'revenue', isPostable: true, active: true, system: true },
  { id: 'acc-sales-ret', code: '4-1200', name: 'Retur Penjualan', type: 'revenue', isPostable: true, active: true, system: true },
  { id: 'acc-cogs', code: '5-1100', name: 'HPP', type: 'expense', isPostable: true, active: true, system: true },
  { id: 'acc-exp', code: '5-2100', name: 'Beban Operasional', type: 'expense', isPostable: true, active: true, system: true },
  { id: 'acc-payroll', code: '5-2200', name: 'Beban Gaji', type: 'expense', isPostable: true, active: true, system: true },
  { id: 'acc-mfg', code: '5-2300', name: 'Overhead Produksi (alokasi)', type: 'expense', isPostable: true, active: true, system: true },
]

export const DEFAULT_ACCOUNT_MAP: AccountMap = {
  cash: 'acc-cash',
  ap: 'acc-ap',
  ar: 'acc-ar',
  inventoryGabah: 'acc-inv-gabah',
  inventoryBeras: 'acc-inv-beras',
  wip: 'acc-wip',
  cogs: 'acc-cogs',
  sales: 'acc-sales',
  salesReturn: 'acc-sales-ret',
  expenseOps: 'acc-exp',
  payroll: 'acc-payroll',
  mfgOverhead: 'acc-mfg',
  openingEquity: 'acc-equity',
  ppnOut: 'acc-ppn-out',
  ppnIn: 'acc-ppn-in',
}

export function nextJournalId(list: JournalEntry[], date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const prefix = `JE-${y}${m}${d}-`
  let max = 0
  for (const j of list) {
    if (!j.id.startsWith(prefix)) continue
    const n = Number(j.id.slice(prefix.length))
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** Net balance per accountId: debit − credit (sign by nature applied in reports). */
export function accountBalanceMap(journals: JournalEntry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const j of journals) {
    if (j.voidedAt || j.reversesId) continue
    for (const line of j.lines) {
      m.set(line.accountId, (m.get(line.accountId) ?? 0) + line.debit - line.credit)
    }
  }
  return m
}
