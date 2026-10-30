# Rekon bank + tutup periode (2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce period locks that block all dated posts (unlock via impacted-role approvals + admin final), and CSV bank reconciliation with auto-match to cash + adjustment journals — on `egabah.period.v1` + `egabah.bank.v1`.

**Architecture:** Two thin modules mirroring tax 2b. Pure `assertPeriodOpen(isoDate)` reads `periodRepository` (sync cache) so ops/finance can gate without React nesting. Unlock computes `requiredRoles` from live ops/finance data at request time. Bank sessions parse CSV → match `cashEntries` (exact amount + ±2 calendar days after normalizing display dates to ISO) → optional adj JE `bank:{sessionId}:adj:{lineId}` vs `bankSuspense`.

**Tech Stack:** React 19, Vite, Tailwind 4, TypeScript, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-30-bank-recon-period-lock-design.md`

## Global Constraints

- Lock blocks **all** post/void that write a document/JE date inside an active `PeriodLock` — gate **before** mutation (no half-post).
- Unlock is never instant: `UnlockRequest` → approve only roles in `requiredRoles` (snapshot; roles without activity are omitted entirely) → **admin final** → deactivate lock.
- Period grain: `month` (`YYYY-MM`) or custom `range`; reject overlapping active locks.
- Rekon: single cash account = `AccountMap.cash`; CSV only (no OFX/API); match kas only (not AP/AR).
- Adj JE uses AccountMap `bankSuspense` (seed); dual-track toast if JE fails after match/adj UI action.
- No Vitest; verify with `npx tsc -p tsconfig.app.json --noEmit` + spek manual checks.
- `CashEntry.date` stays `formatDateId()` (id-ID display); bank match + unlock impact parse via `parseCashDateToIso` helper.
- Preserve Finance* UI patterns (not OpsChrome) for Periode / Rekon pages.
- Forward-only: no auto backfill of historical locks/recon.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/features/keuangan/period-data.ts` | `PeriodLock`, `UnlockRequest`, `PeriodSnapshot`, unlock history types |
| `src/features/keuangan/period-helpers.ts` | Month bounds, overlap, `assertPeriodOpenAgainst`, `parseCashDateToIso`, `isoInRange` |
| `src/features/keuangan/period-gate.ts` | `assertPeriodOpen(iso)` → load repo + helper |
| `src/features/keuangan/period-impact.ts` | `computeRequiredRoles({ start, end, …stores })` |
| `src/features/keuangan/period-storage.ts` | `egabah.period.v1` |
| `src/features/keuangan/period-store.tsx` | `PeriodProvider` / CRUD lock + unlock workflow |
| `src/features/keuangan/bank-data.ts` | `BankSession`, `BankLine`, `BankSnapshot` |
| `src/features/keuangan/bank-csv.ts` | Parse CSV → draft lines |
| `src/features/keuangan/bank-match.ts` | Auto-match suggestions |
| `src/features/keuangan/bank-storage.ts` | `egabah.bank.v1` |
| `src/features/keuangan/bank-store.tsx` | Sessions, match, ignore, adj via finance `postJournalEntry` |
| `src/features/keuangan/gl-data.ts` | Seed + map `bankSuspense` |
| `src/features/keuangan/gl-storage.ts` | Normalize missing map key (already merges DEFAULT) |
| `src/pages/modules/keuangan/AccountMapPage.tsx` | Label `bankSuspense` |
| `src/pages/modules/keuangan/PeriodePage.tsx` | Lock UI + unlock approvals |
| `src/pages/modules/keuangan/RekonBankPage.tsx` | CSV rekon UI |
| Contexts / stores listed in Task 3 | Call `assertPeriodOpen` |
| `src/features/nav/nav-config.ts`, `src/app/router.tsx`, `src/App.tsx` | Nav, routes, providers |
| `docs/DOMAIN.md` | Period + bank entities |

---

### Task 0: Branch + mark spek approved

**Files:**
- Modify: `docs/superpowers/specs/2026-10-30-bank-recon-period-lock-design.md`

- [ ] **Step 1: Foundation**

```bash
git branch --show-current
git log -3 --oneline
npx tsc -p tsconfig.app.json --noEmit
```

Expected: `main` (or clean branch from main with 2b), tsc exit 0.

- [ ] **Step 2: Feature branch**

```bash
git checkout -b feat/bank-recon-period-lock
```

- [ ] **Step 3: Mark spek approved**

Set status line to: `Status: approved (user: gas → plan)`.

```bash
git add docs/superpowers/specs/2026-10-30-bank-recon-period-lock-design.md
git commit -m "docs: mark 2c bank recon period lock spek approved"
```

---

### Task 1: Period types, helpers, storage, gate

**Files:**
- Create: `src/features/keuangan/period-data.ts`
- Create: `src/features/keuangan/period-helpers.ts`
- Create: `src/features/keuangan/period-storage.ts`
- Create: `src/features/keuangan/period-gate.ts`

**Interfaces:**
- Produces: `PeriodLock`, `UnlockRequest`, `periodRepository`, `assertPeriodOpen(isoDate: string): string | undefined`, `monthBounds(yearMonth)`, `locksOverlap`, `parseCashDateToIso`

- [ ] **Step 1: Types** — `period-data.ts`

```ts
import type { ApprovalStamp } from '@/features/workflow/approvals'
import type { UserRole } from '@/types/auth'

export type PeriodKind = 'month' | 'range'

export type UnlockHistoryEntry = {
  at: string
  by: string
  reason: string
  requestId?: string
}

export type PeriodLock = {
  id: string
  kind: PeriodKind
  yearMonth?: string // YYYY-MM
  startDate: string // YYYY-MM-DD inclusive
  endDate: string
  active: boolean
  lockedAt: string
  lockedBy: string
  unlockHistory: UnlockHistoryEntry[]
  pendingUnlockRequestId?: string
}

export type UnlockRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

/** Ops roles that can appear in requiredRoles — never includes admin */
export type UnlockImpactRole = Exclude<UserRole, 'admin'>

export type UnlockRequest = {
  id: string
  periodLockId: string
  reason: string
  status: UnlockRequestStatus
  requiredRoles: UnlockImpactRole[]
  approvals: ApprovalStamp[]
  adminApproval?: ApprovalStamp
  rejectedBy?: string
  rejectReason?: string
  createdAt: string
  createdBy: string
}

export type PeriodSnapshot = {
  version: 1
  locks: PeriodLock[]
  unlockRequests: UnlockRequest[]
  updatedAt: string
}
```

- [ ] **Step 2: Helpers** — `period-helpers.ts`

```ts
import type { PeriodLock } from '@/features/keuangan/period-data'

const ID_MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
  Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11,
}

/** "30 Okt 2026" | already ISO → YYYY-MM-DD; else undefined */
export function parseCashDateToIso(raw: string): string | undefined {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!m) return undefined
  const month = ID_MONTHS[m[2]]
  if (month == null) return undefined
  const day = Number(m[1])
  const y = Number(m[3])
  const d = new Date(y, month, day)
  if (d.getFullYear() !== y || d.getMonth() !== month || d.getDate() !== day)
    return undefined
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export function monthBounds(yearMonth: string): { startDate: string; endDate: string } {
  const [ys, ms] = yearMonth.split('-')
  const y = Number(ys)
  const m = Number(ms) // 1-12
  const startDate = `${ys}-${ms}-01`
  const last = new Date(y, m, 0).getDate()
  const endDate = `${ys}-${ms}-${String(last).padStart(2, '0')}`
  return { startDate, endDate }
}

export function isoInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end
}

export function locksOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

export function assertPeriodOpenAgainst(
  locks: PeriodLock[],
  isoDate: string,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return `Tanggal tidak valid untuk kunci periode: ${isoDate}`
  }
  const hit = locks.find(
    (l) => l.active && isoInRange(isoDate, l.startDate, l.endDate),
  )
  if (!hit) return undefined
  const label =
    hit.kind === 'month' && hit.yearMonth
      ? hit.yearMonth
      : `${hit.startDate}–${hit.endDate}`
  return `Periode terkunci (${label}). Buat permintaan unlock dan tunggu persetujuan.`
}
```

- [ ] **Step 3: Storage + gate**

`period-storage.ts` — mirror `tax-storage.ts` with key `egabah.period.v1`, seed empty locks/requests.

`period-gate.ts`:

```ts
import { assertPeriodOpenAgainst } from '@/features/keuangan/period-helpers'
import { periodRepository } from '@/features/keuangan/period-storage'

export function assertPeriodOpen(isoDate: string): string | undefined {
  const snap = periodRepository.load()
  return assertPeriodOpenAgainst(snap.locks, isoDate)
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/period-data.ts src/features/keuangan/period-helpers.ts src/features/keuangan/period-storage.ts src/features/keuangan/period-gate.ts
git commit -m "feat(keuangan): period lock types, helpers, storage, gate"
```

---

### Task 2: `computeRequiredRoles` + PeriodProvider

**Files:**
- Create: `src/features/keuangan/period-impact.ts`
- Create: `src/features/keuangan/period-store.tsx`
- Modify: `src/App.tsx` — wrap `PeriodProvider` (outside or inside Finance is fine; gate uses repo)

**Interfaces:**
- Consumes: period types/helpers/storage; `ApprovalStamp` / `upsertApproval` / `hasApproval`; ops lists passed in
- Produces: `usePeriodStore()` with `lockMonth`, `lockRange`, `requestUnlock`, `approveUnlockRole`, `approveUnlockAdmin`, `rejectUnlock`

- [ ] **Step 1: Impact** — `period-impact.ts`

```ts
import { parseCashDateToIso, isoInRange } from '@/features/keuangan/period-helpers'
import type { UnlockImpactRole } from '@/features/keuangan/period-data'

export type ImpactSources = {
  startDate: string
  endDate: string
  saleOrders: { date: string; status: string }[]
  saleReturns: { date?: string; postedAt?: string; status: string }[]
  purchases: { date: string; status: string }[]
  purchaseReturns: { date?: string; postedAt?: string; status: string }[]
  batches: { startedAt?: string; completedAt?: string; status: string }[]
  packRuns: { postedAt?: string; status: string }[]
  stockMovements: { date: string }[] // display or iso
  cashEntries: { date: string }[]
  expenses: { date: string; status: string }[]
  journals: { date: string }[] // already ISO
  payrollRuns: { postedAt?: string; status: string }[]
}

function anyIsoInRange(isos: (string | undefined)[], start: string, end: string): boolean {
  return isos.some((i) => i && isoInRange(i, start, end))
}

export function computeRequiredRoles(src: ImpactSources): UnlockImpactRole[] {
  const { startDate: s, endDate: e } = src
  const roles = new Set<UnlockImpactRole>()

  if (
    src.saleOrders.some((o) => o.status !== 'void' && isoInRange(o.date, s, e)) ||
    src.saleReturns.some(
      (r) =>
        r.status === 'posted' &&
        anyIsoInRange([r.postedAt, r.date], s, e),
    )
  ) {
    roles.add('penjualan')
  }

  if (
    src.purchases.some((p) => p.status !== 'void' && isoInRange(p.date, s, e)) ||
    src.purchaseReturns.some(
      (r) =>
        r.status === 'posted' &&
        anyIsoInRange([r.postedAt, r.date], s, e),
    )
  ) {
    roles.add('pembelian')
  }

  if (
    src.batches.some((b) =>
      anyIsoInRange([b.startedAt, b.completedAt], s, e),
    ) ||
    src.packRuns.some((p) => p.postedAt && isoInRange(p.postedAt, s, e))
  ) {
    roles.add('produksi')
  }

  if (
    src.stockMovements.some((m) => {
      const iso = parseCashDateToIso(m.date) ?? (/^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : undefined)
      return iso && isoInRange(iso, s, e)
    })
  ) {
    roles.add('gudang')
  }

  const toIso = (d: string) =>
    parseCashDateToIso(d) ?? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined)

  const financeHit =
    src.cashEntries.some((c) => {
      const iso = toIso(c.date)
      return iso != null && isoInRange(iso, s, e)
    }) ||
    src.expenses.some((x) => {
      if (x.status !== 'posted') return false
      const iso = toIso(x.date)
      return iso != null && isoInRange(iso, s, e)
    }) ||
    src.journals.some((j) => isoInRange(j.date, s, e)) ||
    src.payrollRuns.some(
      (r) => r.postedAt != null && isoInRange(r.postedAt, s, e),
    )

  if (financeHit) roles.add('keuangan')

  return [...roles]
}
```

When wiring, map real SaleOrder / Batch / Expense / PackRun / payroll field names into `ImpactSources` (role mapping stays as spek).

- [ ] **Step 2: Store** — `period-store.tsx`

API (signatures):

```ts
lockMonth(yearMonth: string, by: string): string | undefined
lockRange(startDate: string, endDate: string, by: string): string | undefined
requestUnlock(lockId: string, reason: string, by: string, impact: ImpactSources): string | undefined
approveUnlockRole(requestId: string, stamp: ApprovalStamp): string | undefined
approveUnlockAdmin(requestId: string, stamp: ApprovalStamp): string | undefined // stamp.role must be admin
rejectUnlock(requestId: string, by: string, reason: string): string | undefined
```

Rules:
- `lock*`: build bounds; if any **active** lock overlaps → error string; else push lock `active:true`.
- `requestUnlock`: reason non-empty; lock active; no other pending for lock; `requiredRoles = computeRequiredRoles(impact)`; create request `pending`; set `lock.pendingUnlockRequestId`.
- `approveUnlockRole`: request pending; `stamp.role` ∈ `requiredRoles`; `upsertApproval`; do **not** deactivate yet.
- `approveUnlockAdmin`: all `requiredRoles` have `hasApproval` (or requiredRoles empty); set `adminApproval`; then set request `approved`, lock `active=false`, push `unlockHistory`, clear `pendingUnlockRequestId`.
- `rejectUnlock`: status `rejected`; clear pending id on lock; lock stays active.
- Persist via `periodRepository.save` on every change.

- [ ] **Step 3: App provider**

```tsx
<FinanceProvider>
  <PeriodProvider>
    <TaxProvider>
      …
    </TaxProvider>
  </PeriodProvider>
</FinanceProvider>
```

- [ ] **Step 4: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/period-impact.ts src/features/keuangan/period-store.tsx src/App.tsx
git commit -m "feat(keuangan): PeriodProvider lock + multi-role unlock"
```

---

### Task 3: Wire `assertPeriodOpen` at mutation sites

**Files (modify):**
- `src/features/penjualan/PenjualanContext.tsx` — `shipOrder`, `voidOrder`, `addPayment`, `postSaleReturn` (and `createOrder` if it posts dated doc that must not land in locked period)
- `src/features/pembelian/PembelianContext.tsx` — `confirmWeighing`, `voidPurchase`, `addPayment`, `postPurchaseReturn`
- `src/features/keuangan/finance-store.tsx` — `addCashEntry`, `removeCashEntry`, `payPayable`, `receiveReceivable`, `addExpense` / `setExpenseStatus`, `postJournalEntry`, `reverseJournalEntry`, `retryFailedPost`
- `src/features/keuangan/payroll-store.tsx` — `postRun`, `voidRun`
- `src/features/produksi/ProduksiContext.tsx` — `startBatch`, `completeBatch`, `voidBatch`, `postPackRun`, `voidPackRun`
- `src/features/persediaan/persediaan-store.tsx` — `addCorrection` (and `voidCorrection`); skip raw `addMovement` if only called from already-gated ops — **do** gate `addCorrection`

**Interfaces:**
- Consumes: `assertPeriodOpen` from `@/features/keuangan/period-gate`
- For “today” cash/ops: use ISO `todayGlDate` pattern — export shared helper or duplicate 3-line ISO today next to gate call

- [ ] **Step 1: Shared today ISO**

Either export `todayGlDate` from a tiny `src/features/keuangan/gl-dates.ts` (move from finance-store) **or** add `todayIsoDate()` in `period-helpers.ts`:

```ts
export function todayIsoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
```

Prefer one helper; update finance-store to import it if you move `todayGlDate`.

- [ ] **Step 2: Pattern at top of each mutating function**

```ts
import { assertPeriodOpen } from '@/features/keuangan/period-gate'

// example shipOrder — date used for JE/tax:
const date = todayIso() // existing penjualan helper
const locked = assertPeriodOpen(date)
if (locked) return locked // or setError / return { ok:false, error: locked } matching existing API

// example addCashEntry:
const locked = assertPeriodOpen(todayIsoDate())
if (locked) { /* surface to caller — change return type to string | undefined if currently void */ }
```

If `addCashEntry` is currently `void`, change to `string | undefined` and update `KasPage` to toast the error (same as other finance errors).

`postJournalEntry`: gate on `input.date` **before** `postJournal`.

`reverseJournalEntry`: gate on reverse date (`todayIsoDate()`).

`retryFailedPost`: gate on `item.payload.date`.

Payment dates: gate on `payment.date` (ensure ISO).

- [ ] **Step 3: Typecheck all call sites + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/penjualan/PenjualanContext.tsx src/features/pembelian/PembelianContext.tsx src/features/keuangan/finance-store.tsx src/features/keuangan/payroll-store.tsx src/features/produksi/ProduksiContext.tsx src/features/persediaan/persediaan-store.tsx src/features/keuangan/period-helpers.ts src/pages/modules/keuangan/KasPage.tsx
git commit -m "feat(ops): gate dated posts with assertPeriodOpen"
```

---

### Task 4: PeriodePage + nav/router

**Files:**
- Create: `src/pages/modules/keuangan/PeriodePage.tsx`
- Modify: `src/features/nav/nav-config.ts`, `src/app/router.tsx`

- [ ] **Step 1: Page behavior**

Shell like `EFakturPage` / `KasPage` (FinanceFilterBar / table / FinanceModal / FinanceToast / DetailDrawer).

1. List active + inactive locks.
2. Form: radio month | range → confirm → `lockMonth` / `lockRange` (`useAuth().user`).
3. On active lock: “Minta unlock” → reason → gather `ImpactSources` from `usePenjualan` / `usePembelian` / `useProduksi` / `useFinanceStore` / `usePayroll` / persediaan movements → `requestUnlock`.
4. Pending request panel: for each role in `requiredRoles`, show Approve if `user.role === that role` and not yet approved; show Admin final only if all role stamps present (or requiredRoles empty) and `user.role === 'admin'`.
5. Reject button for required role or admin.
6. Roles not in `requiredRoles` see no approve button (and no empty placeholders for them).

- [ ] **Step 2: Nav + route**

```ts
{ id: 'periode', label: 'Periode', path: '/app/keuangan/periode', roles: ['admin', 'keuangan', 'pembelian', 'penjualan', 'produksi', 'gudang'] },
```

(Unlock approvers need nav access; locking still enforced in page actions via role checks — only `admin|keuangan` can create locks / request unlock.)

```tsx
<Route path="periode" element={<PeriodePage />} />
```

- [ ] **Step 3: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/pages/modules/keuangan/PeriodePage.tsx src/features/nav/nav-config.ts src/app/router.tsx
git commit -m "feat(keuangan): Periode page lock + unlock approvals"
```

---

### Task 5: AccountMap `bankSuspense`

**Files:**
- Modify: `src/features/keuangan/gl-data.ts`
- Modify: `src/pages/modules/keuangan/AccountMapPage.tsx`

- [ ] **Step 1: Seed**

Add to `AccountMapKey`: `'bankSuspense'`.

```ts
{ id: 'acc-bank-suspense', code: '1-1600', name: 'Selisih Rekon Bank', type: 'asset', isPostable: true, active: true, system: true },
```

```ts
bankSuspense: 'acc-bank-suspense',
```

Label: `bankSuspense: 'Selisih rekon bank'`.

`normalizeGlSnapshot` already merges `DEFAULT_ACCOUNT_MAP` — confirm missing accounts get appended like PPN (if PPN had explicit account merge, mirror that for `acc-bank-suspense`).

- [ ] **Step 2: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/gl-data.ts src/features/keuangan/gl-storage.ts src/pages/modules/keuangan/AccountMapPage.tsx
git commit -m "feat(keuangan): seed AccountMap bankSuspense"
```

---

### Task 6: Bank types, CSV parse, auto-match, storage

**Files:**
- Create: `src/features/keuangan/bank-data.ts`
- Create: `src/features/keuangan/bank-csv.ts`
- Create: `src/features/keuangan/bank-match.ts`
- Create: `src/features/keuangan/bank-storage.ts`

**Interfaces:**
- Produces: `parseBankCsv(text) => { lines: Omit<BankLine,'id'|'sessionId'|'status'>[], error?: string }`, `suggestMatches(lines, cashEntries, alreadyMatchedIds)`, `bankRepository`

- [ ] **Step 1: Types**

```ts
export type BankLineStatus = 'unmatched' | 'matched' | 'ignored' | 'adjusted'

export type BankSession = {
  id: string
  startDate: string
  endDate: string
  cashAccountId: string
  statementBalance?: number
  status: 'open' | 'closed'
  createdAt: string
  createdBy: string
}

export type BankLine = {
  id: string
  sessionId: string
  date: string // YYYY-MM-DD
  memo: string
  amount: number // + in, - out
  bankRef?: string
  status: BankLineStatus
  cashEntryId?: string
  journalSourceKey?: string
  suggestedCashEntryId?: string
}

export type BankSnapshot = {
  version: 1
  sessions: BankSession[]
  lines: BankLine[]
  updatedAt: string
}
```

- [ ] **Step 2: CSV** — `bank-csv.ts`

Accept header row; map columns case-insensitive:
- date / tanggal
- description / deskripsi / memo / keterangan
- amount / jumlah **or** debit+kredit / masuk+keluar
- ref / reference / no (optional)

Parse dates: `YYYY-MM-DD` or `DD/MM/YYYY`. Amounts: strip `Rp`, dots; comma decimal → int rupiah (round). Debit/credit → signed amount (credit out = negative **or** document chosen convention in UI: **bank statement credit to account = +in**).

Return error string if zero parseable rows.

- [ ] **Step 3: Match** — `bank-match.ts`

```ts
import { parseCashDateToIso } from '@/features/keuangan/period-helpers'
import type { CashEntry } from '@/features/keuangan/keuangan-data'

const DAY_MS = 86_400_000

function daysApart(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00`).getTime()
  const b = new Date(`${bIso}T00:00:00`).getTime()
  return Math.round(Math.abs(a - b) / DAY_MS)
}

/** Cash in = +amount, out = -amount for compare to bank signed amount */
export function cashSignedAmount(e: CashEntry): number {
  return e.direction === 'in' ? e.amount : -e.amount
}

export function suggestMatches(
  unmatched: { id: string; date: string; amount: number }[],
  cashEntries: CashEntry[],
  takenCashIds: Set<string>,
): Map<string, string> {
  const out = new Map<string, string>()
  const pool = cashEntries.filter((c) => !takenCashIds.has(c.id))
  for (const line of unmatched) {
    const hit = pool.find((c) => {
      const cIso = parseCashDateToIso(c.date)
      if (!cIso) return false
      if (cashSignedAmount(c) !== line.amount) return false
      return daysApart(line.date, cIso) <= 2
    })
    if (hit) {
      out.set(line.id, hit.id)
      takenCashIds.add(hit.id)
      // remove from pool
      const idx = pool.findIndex((p) => p.id === hit.id)
      if (idx >= 0) pool.splice(idx, 1)
    }
  }
  return out
}
```

- [ ] **Step 4: Storage + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/bank-data.ts src/features/keuangan/bank-csv.ts src/features/keuangan/bank-match.ts src/features/keuangan/bank-storage.ts
git commit -m "feat(keuangan): bank recon types, CSV parse, auto-match"
```

---

### Task 7: BankProvider — session, match, adj JE

**Files:**
- Create: `src/features/keuangan/bank-store.tsx`
- Modify: `src/App.tsx` — `BankProvider` inside `FinanceProvider` (needs `postJournalEntry` / `mapAccount` / `cashEntries`)

**Interfaces:**
- Produces: `createSession`, `importCsv`, `runAutoMatch`, `acceptSuggestion`, `rejectSuggestion`, `manualMatch`, `ignoreLine`, `postAdjustment`, `sessionSummary`

- [ ] **Step 1: Store methods**

```ts
createSession(input: { startDate; endDate; statementBalance?; by }): string | undefined
// cashAccountId = mapAccount('cash')

importCsv(sessionId: string, csvText: string): string | undefined
// parseBankCsv; append BankLines status unmatched

runAutoMatch(sessionId: string): void
// taken = lines already matched/adjusted cashEntryIds
// suggestMatches → set suggestedCashEntryId on lines

acceptSuggestion(lineId: string): string | undefined
rejectSuggestion(lineId: string): void
manualMatch(lineId: string, cashEntryId: string): string | undefined
ignoreLine(lineId: string): void

postAdjustment(
  lineId: string,
  opts: { memo?: string },
): string | undefined
```

`postAdjustment` logic:
1. Line must be `unmatched`.
2. `assertPeriodOpen(line.date)` — return error if locked.
3. `sourceKey = \`bank:${sessionId}:adj:${lineId}\``.
4. Amount `abs = Math.abs(line.amount)`. If `line.amount > 0` (bank in not in books): Dr cash / Cr bankSuspense. If `< 0`: Dr bankSuspense / Cr cash.
5. `postJournalEntry({ date: line.date, memo, sourceKey, sourceType: 'auto', manual: false, lines })`.
6. If JE error → return error (line stays unmatched; dual-track toast on page). If ok → line `adjusted`, set `journalSourceKey`.

Do **not** create a new `CashEntry` for adj (GL-only adj keeps kas UI unchanged; spek adj is JE). Document this in DOMAIN.

- [ ] **Step 2: Summary helper**

```ts
export function sessionSummary(lines: BankLine[]): {
  matched: number
  unmatched: number
  ignored: number
  adjusted: number
} { … }
```

Optional book vs statement: `statementBalance - glCashBalance` — if easy via journals filter cash account, show; else show line counts only (YAGNI if heavy).

- [ ] **Step 3: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/bank-store.tsx src/App.tsx
git commit -m "feat(keuangan): BankProvider match + adjustment journals"
```

---

### Task 8: RekonBankPage + nav

**Files:**
- Create: `src/pages/modules/keuangan/RekonBankPage.tsx`
- Modify: `src/features/nav/nav-config.ts`, `src/app/router.tsx`

- [ ] **Step 1: UI**

1. List sessions / create (date range + optional statement balance).
2. Detail: file input CSV → `importCsv`; help text listing expected columns.
3. Button Auto-match → accept/reject per suggested row.
4. Manual match select from unmatched cash in range; Ignore; Post adj.
5. Summary counts + FinanceToast on errors.

Roles: `admin` | `keuangan` only.

```ts
{ id: 'rekon-bank', label: 'Rekon Bank', path: '/app/keuangan/rekon-bank', roles: ['admin', 'keuangan'] },
```

```tsx
<Route path="rekon-bank" element={<RekonBankPage />} />
```

- [ ] **Step 2: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/pages/modules/keuangan/RekonBankPage.tsx src/features/nav/nav-config.ts src/app/router.tsx
git commit -m "feat(keuangan): Rekon Bank page CSV match adj"
```

---

### Task 9: DOMAIN.md + final verify

**Files:**
- Modify: `docs/DOMAIN.md`
- Modify: `docs/superpowers/specs/2026-10-30-bank-recon-period-lock-design.md` (status already approved)

- [ ] **Step 1: DOMAIN**

Add table rows: `PeriodLock` / `UnlockRequest` → `egabah.period.v1`; `BankSession` / `BankLine` → `egabah.bank.v1`.

Section gelombang 2c:
- `assertPeriodOpen` call-site list (ship, receive, payments, cash, expense, payroll, journals, batch/pack, stock correction, bank adj)
- Unlock: impacted roles only + admin final
- Match rules ±2d exact signed amount; `sourceKey` `bank:{session}:adj:{line}`
- AccountMap `bankSuspense`
- Out of scope: OFX, multi-account, auto month lock

- [ ] **Step 2: Manual checklist**

1. `npx tsc -p tsconfig.app.json --noEmit`
2. Lock month → ship/receive/biaya/kas/jurnal in month blocked; outside OK
3. Unlock request shows only impacted roles; reject keeps lock; full approve + admin unlocks
4. Overlap lock rejected
5. CSV → auto-match → accept; manual; ignore; adj JE visible in Jurnal
6. Adj during locked period blocked; JE fail still toasts

- [ ] **Step 3: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add docs/DOMAIN.md
git commit -m "docs: DOMAIN period lock + bank recon"
```

---

## Self-review (plan vs spek)

| Spek requirement | Task |
| --- | --- |
| `egabah.period.v1` PeriodLock + UnlockRequest | 1–2 |
| `assertPeriodOpen` before all dated posts | 1, 3 |
| Month + range; no overlap | 2, 4 |
| Unlock: impacted roles only + admin final; reject | 2, 4 |
| `egabah.bank.v1` session/lines | 6–7 |
| CSV + auto-match ±2d exact + manual/ignore | 6–8 |
| Adj JE `bank:…:adj:…` + `bankSuspense` | 5, 7–8 |
| UI `/periode` + `/rekon-bank` | 4, 8 |
| DOMAIN | 9 |
| No OFX / multi-account / Vitest / auto lock | Global constraints |

**Placeholder scan:** no TBD/TODO; ImpactSources field mapping is inspect-on-wire of existing entity shapes only.

**Type consistency:** `UnlockImpactRole`, `assertPeriodOpen`, `parseCashDateToIso`, `sourceKey` pattern, `BankLineStatus` aligned across tasks.
