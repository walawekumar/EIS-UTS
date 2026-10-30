# Accounting GL COA / Journals / WIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chart of accounts, idempotent auto + manual journals (dual-track with kas/AP/AR), production WIP stock+journal alignment, opening balances, and basic GL reports — localStorage only, no PPN/e-Faktur/bank recon/period lock.

**Architecture:** New `egabah.gl.v1` snapshot loaded beside keuangan. Pure helpers `postJournal` / `reverseJournal` + builders; finance-store persists GL and exposes APIs. Domain contexts call journal after successful ops. `startBatch` consumes gabah→WIP; `completeBatch` posts FG without re-consuming gabah.

**Tech Stack:** React 19, React Router 7, Vite, Tailwind 4, localStorage repos. Verify with `npx tsc -p tsconfig.app.json --noEmit` (prefer over root `tsc`; no Vitest).

**Spec:** `docs/superpowers/specs/2026-10-30-accounting-gl-coa-journals-design.md`

## Global Constraints

- No `window.confirm` / `prompt` / `alert` — use `ConfirmDialog`.
- `npx tsc -p tsconfig.app.json --noEmit` clean after every task.
- No PPN, e-Faktur, bank recon, enforced period lock, or historical journal backfill.
- Dual-track: kas/AP/AR APIs unchanged; GL written in parallel via `sourceKey`.
- Journal lines must balance; reject unbalanced manual JE with string error.
- Idempotent `sourceKey`: never double-post; reverse once.
- Ops success + journal fail → `FailedJournalPost` + retry UI; do not roll back ops.
- Preserve Finance* / OpsChrome / ConfirmDialog patterns.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/features/keuangan/gl-data.ts` | Account, JournalEntry, AccountMap, seed COA, builders, balances |
| `src/features/keuangan/gl-journal.ts` | `postJournal`, `reverseJournal`, failed-queue helpers |
| `src/features/keuangan/gl-storage.ts` | `egabah.gl.v1` repository |
| `src/features/keuangan/finance-store.tsx` | Load/save GL; expose journal/COA APIs |
| `src/features/pembelian/PembelianContext.tsx` | Journals on receive/pay/return (+ reverse void) |
| `src/features/penjualan/PenjualanContext.tsx` | Journals on ship/pay/COD/return |
| `src/features/keuangan/finance-store.tsx` | Journals on expense post (same file) |
| `src/features/payroll/payroll-store.tsx` | Journals on payroll post/void |
| `src/features/produksi/ProduksiContext.tsx` | WIP stock on start; journals start/done/pack |
| `src/pages/modules/keuangan/CoaPage.tsx` | COA CRUD-ish |
| `src/pages/modules/keuangan/JurnalPage.tsx` | List, manual, reverse, retry, opening |
| `src/pages/modules/keuangan/AccountMapPage.tsx` | Default account mapping |
| `src/pages/modules/LaporanPage.tsx` | Trial balance / P&L / balance sheet from GL |
| `src/features/nav/nav-config.ts` + `src/app/router.tsx` | Routes |
| `docs/DOMAIN.md` | Document GL + WIP |

---

### Task 0: Verify foundation

**Files:** none (read-only)

- [ ] **Step 1: Confirm gelombang 1 on main**

```bash
git log --oneline -8
npx tsc -p tsconfig.app.json --noEmit
```

Expected: recent history includes returns/QC/pack/costing; tsc exit 0.

- [ ] **Step 2: No commit**

---

### Task 1: GL types, seed COA, AccountMap, storage

**Files:**
- Create: `src/features/keuangan/gl-data.ts`
- Create: `src/features/keuangan/gl-storage.ts`

**Interfaces:**
- Produces: `Account`, `AccountType`, `AccountMapKey`, `AccountMap`, `JournalLine`, `JournalEntry`, `FailedJournalPost`, `GlSnapshot`, `SEED_ACCOUNTS`, `DEFAULT_ACCOUNT_MAP`, `nextJournalId`, `accountBalanceMap`, `glRepository`

- [ ] **Step 1: Add `gl-data.ts`**

```ts
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
    if (j.voidedAt) continue
    for (const line of j.lines) {
      m.set(line.accountId, (m.get(line.accountId) ?? 0) + line.debit - line.credit)
    }
  }
  return m
}
```

- [ ] **Step 2: Add `gl-storage.ts`**

```ts
// src/features/keuangan/gl-storage.ts
import { createLocalRepository } from '@/lib/create-local-repository'
import {
  DEFAULT_ACCOUNT_MAP,
  SEED_ACCOUNTS,
  type GlSnapshot,
} from '@/features/keuangan/gl-data'

function seed(): GlSnapshot {
  return {
    version: 1,
    accounts: structuredClone(SEED_ACCOUNTS),
    accountMap: { ...DEFAULT_ACCOUNT_MAP },
    journals: [],
    failedPosts: [],
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is GlSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as GlSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.accounts) &&
    Array.isArray(v.journals) &&
    Array.isArray(v.failedPosts) &&
    v.accountMap != null &&
    typeof v.accountMap === 'object'
  )
}

export const glRepository = createLocalRepository({
  key: 'egabah.gl.v1',
  seed,
  isValid,
})
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/keuangan/gl-data.ts src/features/keuangan/gl-storage.ts
git commit -m "feat(keuangan): GL types, seed COA, and egabah.gl.v1 storage"
```

---

### Task 2: Journal engine + failed queue

**Files:**
- Create: `src/features/keuangan/gl-journal.ts`

**Interfaces:**
- Consumes: types from Task 1
- Produces: `PostJournalInput`, `postJournal`, `reverseJournal`, `enqueueFailedPost`, `removeFailedPost`

- [ ] **Step 1: Implement engine**

```ts
// src/features/keuangan/gl-journal.ts
import {
  nextJournalId,
  type Account,
  type FailedJournalPost,
  type JournalEntry,
  type JournalLine,
  type JournalSourceType,
} from '@/features/keuangan/gl-data'

export type PostJournalInput = {
  date: string
  memo: string
  sourceKey?: string
  sourceType: JournalSourceType
  manual: boolean
  lines: JournalLine[]
  createdBy: string
  accounts: Account[]
  journals: JournalEntry[]
}

export type PostJournalResult =
  | { ok: true; entry: JournalEntry; journals: JournalEntry[] }
  | { ok: false; error: string }

function linesBalance(lines: JournalLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0)
  const c = lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(d - c) < 0.005 && d > 0
}

export function postJournal(input: PostJournalInput): PostJournalResult {
  if (input.sourceKey) {
    const existing = input.journals.find(
      (j) => j.sourceKey === input.sourceKey && !j.voidedAt,
    )
    if (existing) return { ok: true, entry: existing, journals: input.journals }
  }
  if (!input.lines.length) return { ok: false, error: 'Jurnal tanpa baris.' }
  if (!linesBalance(input.lines)) {
    return { ok: false, error: 'Debit dan kredit tidak balance.' }
  }
  for (const line of input.lines) {
    if (line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0)) {
      return { ok: false, error: 'Baris jurnal tidak valid.' }
    }
    const acc = input.accounts.find((a) => a.id === line.accountId)
    if (!acc || !acc.active || !acc.isPostable) {
      return { ok: false, error: `Akun tidak dapat diposting: ${line.accountId}` }
    }
  }
  const entry: JournalEntry = {
    id: nextJournalId(input.journals),
    date: input.date,
    memo: input.memo,
    sourceKey: input.sourceKey,
    sourceType: input.sourceType,
    manual: input.manual,
    lines: input.lines,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  return { ok: true, entry, journals: [entry, ...input.journals] }
}

export function reverseJournal(
  journals: JournalEntry[],
  opts: { sourceKey?: string; id?: string; createdBy: string; date: string },
): PostJournalResult {
  const target = journals.find((j) =>
    opts.id ? j.id === opts.id : j.sourceKey === opts.sourceKey && !j.voidedAt,
  )
  if (!target) return { ok: false, error: 'Jurnal tidak ditemukan.' }
  if (target.reversedById) {
    const rev = journals.find((j) => j.id === target.reversedById)
    if (rev) return { ok: true, entry: rev, journals }
  }
  const lines = target.lines.map((l) => ({
    accountId: l.accountId,
    debit: l.credit,
    credit: l.debit,
    memo: l.memo,
  }))
  const revId = nextJournalId(journals)
  const reverseEntry: JournalEntry = {
    id: revId,
    date: opts.date,
    memo: `Reverse ${target.id}: ${target.memo}`,
    sourceKey: target.sourceKey ? `${target.sourceKey}:void` : undefined,
    sourceType: 'reverse',
    manual: false,
    lines,
    createdBy: opts.createdBy,
    createdAt: new Date().toISOString(),
    reversesId: target.id,
  }
  const updated = journals.map((j) =>
    j.id === target.id ? { ...j, reversedById: revId } : j,
  )
  return { ok: true, entry: reverseEntry, journals: [reverseEntry, ...updated] }
}

export function enqueueFailedPost(
  list: FailedJournalPost[],
  item: FailedJournalPost,
): FailedJournalPost[] {
  return [item, ...list.filter((f) => f.sourceKey !== item.sourceKey)]
}

export function removeFailedPost(
  list: FailedJournalPost[],
  sourceKey: string,
): FailedJournalPost[] {
  return list.filter((f) => f.sourceKey !== sourceKey)
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/gl-journal.ts
git commit -m "feat(keuangan): postJournal and reverseJournal engine"
```

---

### Task 3: Wire finance-store GL state + public APIs

**Files:**
- Modify: `src/features/keuangan/finance-store.tsx`

**Interfaces:**
- Consumes: `glRepository`, `postJournal`, `reverseJournal`, enqueue/remove failed
- Produces on store: `accounts`, `accountMap`, `journals`, `failedPosts`, `postJournalEntry`, `reverseJournalEntry`, `retryFailedPost`, `upsertAccount`, `setAccountActive`, `setAccountMap`, `persistGl` internals

- [ ] **Step 1: Load GL beside keuangan**

On provider mount: `const gl = glRepository.load()` → state for accounts, accountMap, journals, failedPosts. Whenever GL state changes, `glRepository.save({ version:1, accounts, accountMap, journals, failedPosts, updatedAt })`.

- [ ] **Step 2: Expose helpers**

```ts
postJournalEntry: (input: {
  date: string
  memo: string
  sourceKey?: string
  sourceType: JournalSourceType
  manual: boolean
  lines: JournalLine[]
}) => string | undefined  // error message

reverseJournalEntry: (opts: { sourceKey?: string; id?: string }) => string | undefined

retryFailedPost: (sourceKey: string) => string | undefined

upsertAccount: (account: Account) => string | undefined
setAccountActive: (id: string, active: boolean) => string | undefined
setAccountMap: (map: AccountMap) => void

mapAccount: (key: AccountMapKey) => string  // resolve id from accountMap
```

`postJournalEntry` on failure with `sourceKey`: call `enqueueFailedPost`. On success: `removeFailedPost`. Use `user.name` as `createdBy`.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/finance-store.tsx
git commit -m "feat(keuangan): expose GL state and journal APIs on finance-store"
```

---

### Task 4: Auto-journals pembelian (receive, pay, return)

**Files:**
- Modify: `src/features/pembelian/PembelianContext.tsx`

**Interfaces:**
- Consumes: `useFinanceStore().postJournalEntry`, `reverseJournalEntry`, `mapAccount` / `accountMap`
- sourceKeys: `po:{id}:receive`, `po:{id}:pay:{payId}`, `pr:{id}:post`, voids → reverse

- [ ] **Step 1: After `upsertPayableFromPurchase` succeeds**

Post: Dr `inventoryGabah` / Cr `ap` for payable amount. On journal error, still keep AP (failed queue handles).

- [ ] **Step 2: After `applyPurchasePayment`**

Dr `ap` / Cr `cash` for payment amount. Include unique `payId` in sourceKey (payment timestamp/id already used in pembelian).

- [ ] **Step 3: After purchase return post + `creditPayable`**

Dr `ap` / Cr `inventoryGabah` for return value. On void return: `reverseJournalEntry({ sourceKey: 'pr:{id}:post' })`.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/pembelian/PembelianContext.tsx
git commit -m "feat(pembelian): auto-journal receive, pay, and purchase returns"
```

---

### Task 5: Auto-journals penjualan (ship, pay, COD, return)

**Files:**
- Modify: `src/features/penjualan/PenjualanContext.tsx`

- [ ] **Step 1: On ship + `upsertReceivableFromSale`**

Two pairs (one entry OK): Dr `ar` Cr `sales` (revenue); Dr `cogs` Cr `inventoryBeras` (COGS = cost if available from lot/avg else 0 — if cost unknown use 0 and skip COGS lines when amount is 0).

- [ ] **Step 2: On AR payment / COD cash**

Dr `cash` Cr `ar`. sourceKey `so:{id}:pay:{payId}` or `so:{id}:cod`.

- [ ] **Step 3: On sale return post**

Dr `salesReturn` Cr `ar`; Dr `inventoryBeras` Cr `cogs` (mirror ship). Void → reverse `sr:{id}:post`.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/penjualan/PenjualanContext.tsx
git commit -m "feat(penjualan): auto-journal ship, pay, COD, and sale returns"
```

---

### Task 6: Auto-journals biaya + payroll

**Files:**
- Modify: `src/features/keuangan/finance-store.tsx` (`setExpenseStatus` → posted)
- Modify: `src/features/payroll/payroll-store.tsx`

- [ ] **Step 1: Expense posted**

`ex:{id}:post` — Dr `expenseOps` Cr `cash`. Void/cancel posted expense if supported → reverse; if only draft revert, reverse when moving off posted.

- [ ] **Step 2: Payroll `postRun` / `voidRun`**

`payrun:{id}:post` — Dr `payroll` Cr `cash`. Void → `reverseJournalEntry`.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/finance-store.tsx src/features/payroll/payroll-store.tsx
git commit -m "feat(keuangan): auto-journal expenses and payroll cash-out"
```

---

### Task 7: WIP stock on start + production/pack journals

**Files:**
- Modify: `src/features/produksi/ProduksiContext.tsx`
- Modify: `src/features/produksi/produksi-data.ts` (if need `wipPosted` / `wipValue` on batch)

**Interfaces:**
- sourceKeys: `batch:{id}:start`, `batch:{id}:done`, `pack:{id}:post`
- Stock: start consumes input gabah → WIP location (use dedicated location code `WIP` or batch `fromLocation`→`WIP`); complete posts outputs only (no second gabah consume)

- [ ] **Step 1: Extend batch flags if needed**

```ts
// on ProductionBatch (optional fields)
wipStockPosted?: boolean
wipGrainValue?: number
```

- [ ] **Step 2: `startBatch`**

When moving `approved` → `processing`: stock-out gabah qty `inputQty` from `fromLocation`; stock-in same qty to location `WIP` (or `toLocation` WIP bucket). Compute `wipGrainValue` from linked PO `effectiveUnitPrice * qty` (same helpers as LotCost grain). Journal: Dr `wip` Cr `inventoryGabah` amount `wipGrainValue`. Set `wipStockPosted: true`.

- [ ] **Step 3: `completeBatch`**

If `wipStockPosted`, stock-out WIP qty input (or skip qty if WIP is value-only location — prefer qty out from `WIP` equal input). Post output lines to `toLocation` as today **without** consuming gabah again (`stockPosted` path must not double-out gabah). Journal `batch:{id}:done`: Dr `inventoryBeras` = LotCost.totalCost; Cr `wip` = wipGrainValue; Cr `mfgOverhead` = allocatedOps (skip zero lines). Persist LotCost as today.

- [ ] **Step 4: `voidBatch`**

Reverse stock WIP/FG as appropriate; `reverseJournalEntry` for start and/or done keys that exist.

- [ ] **Step 5: `postPackRun` / `voidPackRun`**

Journal reclass: Dr `inventoryBeras` (or keep same inventory account) — for SKU reclass within beras, use `inventoryBeras` both sides with memos **or** skip if same account (no-op). Prefer: still post balanced entry with memo lines only if accounts differ; if single inventory account, use zero-amount skip **OR** post Dr/Cr same account with pack value for audit trail (allowed). Spec: Dr tujuan Cr sumber — if same mapped account, post equal Dr/Cr on `inventoryBeras` with line memos (audit) **or** omit journal when accounts identical — **choose omit when accountId equal** to avoid noise.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/produksi/ProduksiContext.tsx src/features/produksi/produksi-data.ts
git commit -m "feat(produksi): WIP stock on start and production/pack journals"
```

---

### Task 8: COA + AccountMap UI + nav/router

**Files:**
- Create: `src/pages/modules/keuangan/CoaPage.tsx`
- Create: `src/pages/modules/keuangan/AccountMapPage.tsx`
- Modify: `src/features/nav/nav-config.ts`
- Modify: `src/app/router.tsx`

- [ ] **Step 1: CoaPage**

Finance table of accounts: code, name, type, active. Add non-system account; edit name/code for non-posted-or always allow name; cannot delete system — `setAccountActive(false)`. Role: keuangan|admin.

- [ ] **Step 2: AccountMapPage**

Select per `AccountMapKey` → postable account. Save via `setAccountMap`.

- [ ] **Step 3: Nav + routes**

Paths: `/app/keuangan/coa`, `/app/keuangan/akun-map` (and jurnal in Task 9). Roles `admin`, `keuangan`.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/pages/modules/keuangan/CoaPage.tsx src/pages/modules/keuangan/AccountMapPage.tsx src/features/nav/nav-config.ts src/app/router.tsx
git commit -m "feat(keuangan): COA and account mapping pages"
```

---

### Task 9: Jurnal UI — list, manual, opening, reverse, retry

**Files:**
- Create: `src/pages/modules/keuangan/JurnalPage.tsx`
- Modify: nav + router

- [ ] **Step 1: List + detail drawer**

Show journals (date, id, memo, sourceKey, sourceType). Filter by date range / sourceType. Detail shows lines.

- [ ] **Step 2: Manual journal modal**

Multi-line editor (account select, debit, credit). Submit → `postJournalEntry` with `manual: true`, `sourceType: 'manual'`. Show error if unbalanced.

- [ ] **Step 3: Opening balances**

Form: lines vs equity — builds `sourceType: 'opening'`, `manual: true`, memo `Saldo awal`. Balance check includes `openingEquity` balancing line auto-added if user enters asset/liability nets.

- [ ] **Step 4: Reverse + failed retry**

ConfirmDialog → `reverseJournalEntry`. Section listing `failedPosts` with Retry → `retryFailedPost`.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/pages/modules/keuangan/JurnalPage.tsx src/features/nav/nav-config.ts src/app/router.tsx
git commit -m "feat(keuangan): journal list, manual, opening, reverse, retry"
```

---

### Task 10: Laporan GL + DOMAIN

**Files:**
- Modify: `src/pages/modules/LaporanPage.tsx`
- Modify: `docs/DOMAIN.md`

- [ ] **Step 1: GL report section/tabs**

From `accountBalanceMap(journals)` + account types:
- Neraca saldo: all postable accounts with debit/credit columns
- Laba rugi: revenue − expense (salesReturn reduces revenue)
- Neraca: assets vs liabilities + equity (+ current P&L)

- [ ] **Step 2: DOMAIN.md**

Document Account, JournalEntry, dual-track, WIP start/complete, FailedJournalPost, out of scope 2a.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/pages/modules/LaporanPage.tsx docs/DOMAIN.md
git commit -m "docs: DOMAIN GL WIP; laporan trial balance and statements"
```

---

## Spec coverage (self-review)

| Spec item | Task |
| --- | --- |
| `egabah.gl.v1` + Account/Journal/FailedPost | 1–2 |
| Engine post/reverse/idempotent | 2–3 |
| Dual-track hooks PO/SO/retur/biaya/payroll | 4–6 |
| WIP start/complete stock + journals + pack | 7 |
| COA / map / jurnal / opening UI | 8–9 |
| Laporan GL | 10 |
| DOMAIN | 10 |
| No PPN/recon/backfill | Global constraints |

## Execution

After plan approval, use subagent-driven-development (recommended) or executing-plans.
