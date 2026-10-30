# PPN 11%/0% + e-Faktur mock (2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-document PPN (11%/0%, exclusive/inclusive) on sale/purchase/expense (+ returns), dual-track GL lines to `ppnOut`/`ppnIn`, and mock e-Faktur (local number, CSV, send/fail) on `egabah.tax.v1`.

**Architecture:** Thin tax module under `features/keuangan/tax-*` + `TaxProvider`. Ops contexts call `computePpn`, persist snapshot fields on source docs + `TaxDoc`, expand auto-journals with PPN lines (same `sourceKey`). e-Faktur page owns settings, list, mock send, CSV export. No DJP API; no Vitest (repo has none) — verify with `npx tsc -p tsconfig.app.json --noEmit` + manual checks from the spek.

**Tech Stack:** React 19, Vite, Tailwind 4, TypeScript, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-30-ppn-efaktur-mock-design.md`

## Global Constraints

- Rate **11 | 0** and price mode **exclusive | inclusive** chosen per document at post — not from `product.taxable`.
- AR/AP/cash/payments use **`totalWithTax`** when snapshot exists; journals: revenue/expense/inventory at **DPP**, PPN on `ppnOut`/`ppnIn`.
- Dual-track: ops success + journal fail → toast + `failedPosts`; do not roll back ops after success.
- Forward-only: no PPN backfill for old docs.
- TaxInvoice only when ship sale with `ppn > 0`.
- Mock send: always succeed unless user checks “Simulasikan gagal”.
- No real DJP/Coretax, no 2c period lock, no Vitest suite.
- `npx tsc -p tsconfig.app.json --noEmit` clean after every task.
- Preserve OpsChrome / FinanceToast / ConfirmDialog patterns.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/features/keuangan/tax-data.ts` | Types: `PpnRate`, `PriceMode`, `TaxDoc`, `TaxInvoice`, `TaxSettings`, `TaxSnapshot` |
| `src/features/keuangan/tax-compute.ts` | Pure `computePpn` |
| `src/features/keuangan/tax-storage.ts` | `egabah.tax.v1` repository |
| `src/features/keuangan/tax-store.tsx` | `TaxProvider` / `useTaxStore` — CRUD TaxDoc/Invoice, settings, mock send, CSV, void |
| `src/features/keuangan/tax-csv.ts` | Build CSV string for e-Faktur export |
| `src/components/keuangan/TaxPostFields.tsx` | Rate + mode selects + DPP/PPN/total preview |
| `src/features/keuangan/gl-data.ts` | Seed + `AccountMapKey` `ppnOut` / `ppnIn` |
| `src/features/keuangan/gl-storage.ts` | Normalize missing PPN accounts/map on load |
| `src/features/keuangan/finance-store.tsx` | Expense tax snapshot + multi-line PPN journal; boot normalize |
| `src/pages/modules/keuangan/AccountMapPage.tsx` | Labels for new keys |
| `src/features/penjualan/penjualan-data.ts` | Snapshot fields; `summarize` → `totalWithTax` |
| `src/features/penjualan/PenjualanContext.tsx` | Ship/return PPN journals + tax records |
| `src/components/penjualan/PengirimanView.tsx` (+ retur UI) | TaxPostFields |
| `src/features/pembelian/pembelian-data.ts` | Snapshot fields; `summarize` → `totalWithTax` |
| `src/features/pembelian/PembelianContext.tsx` | Receive/return PPN |
| Penerimaan / retur beli UI | TaxPostFields |
| `src/pages/modules/keuangan/BiayaPage.tsx` | Tax on post |
| `src/pages/modules/keuangan/EFakturPage.tsx` | List, settings, send mock, CSV |
| `src/features/nav/nav-config.ts`, `src/app/router.tsx`, `src/App.tsx` | Nav, route, provider |
| `docs/DOMAIN.md` | Tax entities + journal rules |

---

### Task 0: Verify foundation + branch

**Files:** none (git only)

- [ ] **Step 1: Confirm polish 2a on main**

```bash
git branch --show-current
git log -5 --oneline
npx tsc -p tsconfig.app.json --noEmit
```

Expected: on `main` (or branch from main with LotCost/toast), tsc exit 0.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feat/ppn-efaktur-mock
```

- [ ] **Step 3: Mark spek approved**

In `docs/superpowers/specs/2026-10-30-ppn-efaktur-mock-design.md`, set `Status: approved (user: ok → plan)`.

```bash
git add docs/superpowers/specs/2026-10-30-ppn-efaktur-mock-design.md
git commit -m "docs: mark 2b PPN e-Faktur spek approved"
```

---

### Task 1: `computePpn` + tax types + storage

**Files:**
- Create: `src/features/keuangan/tax-data.ts`
- Create: `src/features/keuangan/tax-compute.ts`
- Create: `src/features/keuangan/tax-storage.ts`

**Interfaces:**
- Produces: `computePpn({ subtotal, rate, priceMode }) => { dpp, ppn, total }`, `TaxSnapshot` shape, `taxRepository` for `egabah.tax.v1`

- [ ] **Step 1: Types**

Create `src/features/keuangan/tax-data.ts`:

```ts
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
```

- [ ] **Step 2: Pure compute**

Create `src/features/keuangan/tax-compute.ts`:

```ts
import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'

export function computePpn(input: {
  subtotal: number
  rate: PpnRate
  priceMode: PriceMode
}): { dpp: number; ppn: number; total: number } {
  const subtotal = Math.round(input.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return { dpp: 0, ppn: 0, total: 0 }
  }
  if (input.rate === 0) {
    return { dpp: subtotal, ppn: 0, total: subtotal }
  }
  if (input.priceMode === 'exclusive') {
    const dpp = subtotal
    const ppn = Math.round((dpp * input.rate) / 100)
    return { dpp, ppn, total: dpp + ppn }
  }
  const total = subtotal
  const dpp = Math.round(total / (1 + input.rate / 100))
  const ppn = total - dpp
  return { dpp, ppn, total }
}
```

- [ ] **Step 3: Storage**

Create `src/features/keuangan/tax-storage.ts`:

```ts
import { createLocalRepository } from '@/lib/create-local-repository'
import {
  DEFAULT_TAX_SETTINGS,
  type TaxSnapshot,
} from '@/features/keuangan/tax-data'

function seed(): TaxSnapshot {
  return {
    version: 1,
    settings: { ...DEFAULT_TAX_SETTINGS },
    docs: [],
    invoices: [],
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is TaxSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as TaxSnapshot
  return (
    v.version === 1 &&
    v.settings != null &&
    Array.isArray(v.docs) &&
    Array.isArray(v.invoices)
  )
}

export const taxRepository = createLocalRepository({
  key: 'egabah.tax.v1',
  seed,
  isValid,
})
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/tax-data.ts src/features/keuangan/tax-compute.ts src/features/keuangan/tax-storage.ts
git commit -m "feat(keuangan): add tax types, computePpn, egabah.tax.v1 storage"
```

---

### Task 2: GL seed `ppnOut` / `ppnIn` + normalize load

**Files:**
- Modify: `src/features/keuangan/gl-data.ts`
- Modify: `src/features/keuangan/gl-storage.ts`
- Modify: `src/features/keuangan/finance-store.tsx` (boot normalize)
- Modify: `src/pages/modules/keuangan/AccountMapPage.tsx`

**Interfaces:**
- Produces: `AccountMapKey` includes `ppnOut` | `ppnIn`; `normalizeGlSnapshot(snap)` merges missing seed accounts + map keys

- [ ] **Step 1: Extend AccountMapKey + seed**

In `gl-data.ts`, add to `AccountMapKey`:

```ts
  | 'ppnOut'
  | 'ppnIn'
```

Add accounts (after `acc-ap`):

```ts
  { id: 'acc-ppn-out', code: '2-1200', name: 'PPN Keluaran', type: 'liability', isPostable: true, active: true, system: true },
  { id: 'acc-ppn-in', code: '1-1500', name: 'PPN Masukan', type: 'asset', isPostable: true, active: true, system: true },
```

(Note: PPN Masukan is reclaimable → treat as **asset** in seed; PPN Keluaran liability.)

Add to `DEFAULT_ACCOUNT_MAP`:

```ts
  ppnOut: 'acc-ppn-out',
  ppnIn: 'acc-ppn-in',
```

- [ ] **Step 2: Normalize on load**

In `gl-storage.ts`, after `isValid`, add:

```ts
export function normalizeGlSnapshot(snap: GlSnapshot): GlSnapshot {
  const byId = new Map(snap.accounts.map((a) => [a.id, a]))
  for (const a of SEED_ACCOUNTS) {
    if (!byId.has(a.id)) byId.set(a.id, structuredClone(a))
  }
  const accountMap = { ...DEFAULT_ACCOUNT_MAP, ...snap.accountMap }
  for (const key of Object.keys(DEFAULT_ACCOUNT_MAP) as (keyof typeof DEFAULT_ACCOUNT_MAP)[]) {
    if (!accountMap[key]) accountMap[key] = DEFAULT_ACCOUNT_MAP[key]
  }
  return {
    ...snap,
    accounts: [...byId.values()],
    accountMap,
  }
}
```

Change `load` path: in `createLocalRepository` consumers — either wrap in `glRepository.load` via custom load wrapper, or normalize in `FinanceProvider` boot:

```ts
const glBoot = normalizeGlSnapshot(glRepository.load())
```

Prefer normalize in `finance-store.tsx` boot (and persist once so map keys stick).

- [ ] **Step 3: AccountMap labels**

```ts
  ppnOut: 'PPN keluaran',
  ppnIn: 'PPN masukan',
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/gl-data.ts src/features/keuangan/gl-storage.ts src/features/keuangan/finance-store.tsx src/pages/modules/keuangan/AccountMapPage.tsx
git commit -m "feat(keuangan): seed PPN Out/In accounts and normalize GL map"
```

---

### Task 3: TaxProvider API + CSV helper

**Files:**
- Create: `src/features/keuangan/tax-store.tsx`
- Create: `src/features/keuangan/tax-csv.ts`
- Modify: `src/App.tsx` (wrap `TaxProvider` inside `FinanceProvider`, outside ops providers)

**Interfaces:**
- Produces:
  - `recordTaxDoc(input) => TaxDoc`
  - `recordSaleInvoice(taxDoc, saleOrderId) => TaxInvoice | undefined` (only if `ppn > 0`)
  - `voidTaxForSource(sourceType, sourceId) => void`
  - `sendInvoiceMock(id, { simulateFail: boolean }) => void`
  - `updateSettings(partial)`
  - `settings`, `docs`, `invoices`
  - `buildEfakturCsv(invoices, settings) => string`

- [ ] **Step 1: CSV builder**

Create `src/features/keuangan/tax-csv.ts`:

```ts
import type { TaxInvoice, TaxSettings } from '@/features/keuangan/tax-data'

function esc(v: string | number): string {
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Minimal DJP-style practice columns — not certification. */
export function buildEfakturCsv(
  invoices: TaxInvoice[],
  settings: TaxSettings,
): string {
  const header = [
    'NPWP',
    'NomorFaktur',
    'Tanggal',
    'NamaLawanTransaksi',
    'DPP',
    'PPN',
    'Total',
    'Status',
  ].join(',')
  const rows = invoices
    .filter((i) => i.status !== 'void')
    .map((i) =>
      [
        esc(settings.npwp),
        esc(i.number),
        esc(i.date),
        esc(i.partyName ?? ''),
        esc(i.dpp),
        esc(i.ppn),
        esc(i.total),
        esc(i.status),
      ].join(','),
    )
  return [header, ...rows].join('\n')
}
```

- [ ] **Step 2: TaxProvider**

Create `src/features/keuangan/tax-store.tsx` with:

- State from `taxRepository.load()`
- Persist on change (same pattern as GL in finance-store)
- `nextTaxDocId` / `nextInvoiceNumber` using `settings.invoicePrefix` + zero-padded `nextSeq` then bump seq
- `recordTaxDoc` — append TaxDoc
- `recordSaleInvoice` — if `taxDoc.ppn <= 0` return undefined; else create draft TaxInvoice linked to sale
- `voidTaxForSource` — set `voidedAt` on matching non-voided TaxDocs; set related invoices `status: 'void'`
- `sendInvoiceMock(id, { simulateFail })` — if fail: `status: 'failed', failReason: 'Simulasi gagal'`; else `status: 'sent', sentAt: ISO`
- `updateSettings`
- Default rate UI helper: if settings.defaultRate set use it; callers may also read `readAppSettings().finance.ppnRate` as fallback when first mounting UI (document in TaxPostFields)

Exact store shape:

```ts
type TaxStoreValue = {
  settings: TaxSettings
  docs: TaxDoc[]
  invoices: TaxInvoice[]
  updateSettings: (patch: Partial<TaxSettings>) => void
  recordTaxDoc: (input: Omit<TaxDoc, 'id' | 'createdAt' | 'voidedAt'> & { id?: string }) => TaxDoc
  recordSaleInvoice: (taxDoc: TaxDoc, saleOrderId: string, partyName?: string) => TaxInvoice | undefined
  voidTaxForSource: (sourceType: TaxSourceType, sourceId: string) => void
  sendInvoiceMock: (id: string, opts: { simulateFail: boolean }) => string | undefined
}
```

- [ ] **Step 3: Wire App**

```tsx
<FinanceProvider>
  <TaxProvider>
    <PayrollProvider>
      ...
    </PayrollProvider>
  </TaxProvider>
</FinanceProvider>
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/tax-store.tsx src/features/keuangan/tax-csv.ts src/App.tsx
git commit -m "feat(keuangan): TaxProvider, mock send, e-Faktur CSV builder"
```

---

### Task 4: Shared `TaxPostFields` UI

**Files:**
- Create: `src/components/keuangan/TaxPostFields.tsx`

**Interfaces:**
- Consumes: `computePpn`, `PpnRate`, `PriceMode`
- Produces: controlled fields `{ rate, priceMode, onRateChange, onModeChange, subtotal }` → shows DPP/PPN/total

- [ ] **Step 1: Component**

```tsx
import { Select } from '@/components/ui/Select'
import { computePpn } from '@/features/keuangan/tax-compute'
import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'
import { formatIdr } from '@/features/keuangan/keuangan-data'

const RATE_OPTS = [
  { value: '11', label: 'PPN 11%' },
  { value: '0', label: 'PPN 0%' },
]
const MODE_OPTS = [
  { value: 'exclusive', label: 'Harga exclusive (DPP + PPN)' },
  { value: 'inclusive', label: 'Harga inclusive (sudah termasuk PPN)' },
]

export function TaxPostFields(props: {
  subtotal: number
  rate: PpnRate
  priceMode: PriceMode
  onRateChange: (r: PpnRate) => void
  onModeChange: (m: PriceMode) => void
}) {
  const calc = computePpn({
    subtotal: props.subtotal,
    rate: props.rate,
    priceMode: props.priceMode,
  })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label="Tarif PPN"
        value={String(props.rate)}
        options={RATE_OPTS}
        onChange={(v) => props.onRateChange(v === '0' ? 0 : 11)}
      />
      <Select
        label="Mode harga"
        value={props.priceMode}
        options={MODE_OPTS}
        onChange={(v) =>
          props.onModeChange(v === 'inclusive' ? 'inclusive' : 'exclusive')
        }
      />
      <p className="sm:col-span-2 text-sm text-[var(--muted)]">
        DPP {formatIdr(calc.dpp)} · PPN {formatIdr(calc.ppn)} · Total{' '}
        {formatIdr(calc.total)}
      </p>
    </div>
  )
}
```

Adjust `Select` props to match existing component API in repo (label/options/onChange patterns from PengirimanView).

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/components/keuangan/TaxPostFields.tsx
git commit -m "feat(keuangan): TaxPostFields rate/mode preview"
```

---

### Task 5: Penjualan — snapshot, ship/return journals, UI

**Files:**
- Modify: `src/features/penjualan/penjualan-data.ts`
- Modify: `src/features/penjualan/PenjualanContext.tsx`
- Modify: `src/components/penjualan/PengirimanView.tsx`
- Modify: retur jual UI (same folder / `ReturPage` components that call `postSaleReturn`)

**Interfaces:**
- Consumes: `computePpn`, `useTaxStore.recordTaxDoc` / `recordSaleInvoice` / `voidTaxForSource`
- Produces: `DeliveryInput` + `SaleReturnInput` include `ppnRate` + `priceMode`; ship JE Dr AR total / Cr Sales dpp / Cr ppnOut ppn (+ COGS unchanged)

- [ ] **Step 1: Types + summarize**

On `SaleOrder` and `SaleReturn` add `TaxSnapshotFields` fields.

`DeliveryInput`:

```ts
  ppnRate: PpnRate
  priceMode: PriceMode
```

`SaleReturnInput`: same tax fields.

`summarize`:

```ts
  const subtotal = Math.round(order.qty * order.price)
  const total = order.totalWithTax ?? subtotal
```

- [ ] **Step 2: Expand `postPenjualanShipJournal`**

Change signature to accept `{ dpp, ppn, total, cogsAmount }` (not single `revenue`):

```ts
  const lines: JournalLine[] = [
    { accountId: mapAccount('ar'), debit: total, credit: 0, memo },
    { accountId: mapAccount('sales'), debit: 0, credit: dpp, memo },
  ]
  if (ppn > 0) {
    lines.push({
      accountId: mapAccount('ppnOut'),
      debit: 0,
      credit: ppn,
      memo,
    })
  }
  // COGS pair unchanged
```

Return journal:

```ts
  // Dr salesReturn dpp, Dr ppnOut ppn (if >0), Cr AR total (+ COGS reverse)
```

- [ ] **Step 3: `shipOrder` flow**

```ts
const subtotal = current.qty * current.price
const calc = computePpn({
  subtotal,
  rate: input.ppnRate,
  priceMode: input.priceMode,
})
const total = calc.total
// ... upsertReceivable amount: total, COD cash/JE amount: total
// snapshot fields on next SaleOrder
const taxDoc = recordTaxDoc({
  sourceType: 'sale',
  sourceId: next.id,
  date: today,
  ppnRate: input.ppnRate,
  priceMode: input.priceMode,
  dpp: calc.dpp,
  ppn: calc.ppn,
  total: calc.total,
  partyName: party,
})
recordSaleInvoice(taxDoc, next.id, party)
postPenjualanShipJournal(..., { dpp: calc.dpp, ppn: calc.ppn, total: calc.total, cogsAmount })
```

On `voidOrder`: existing `reverseJournalEntry` + `voidTaxForSource('sale', id)`.

- [ ] **Step 4: `postSaleReturn`**

Subtotal = sum(line qty * order.price) for matching SKU (same as current credit basis). Apply `computePpn` from return input rate/mode. Snapshot on `SaleReturn`. `recordTaxDoc` sourceType `saleReturn`. Journal with PPN lines. Credit receivable with `calc.total`.

- [ ] **Step 5: UI**

In PengirimanView ship modal: state for rate/mode from `useTaxStore().settings` (fallback app-settings `ppnRate`), render `TaxPostFields` with `subtotal = order.qty * order.price`, pass into `shipOrder`.

Same pattern on sale return post confirm.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/penjualan src/components/penjualan
git commit -m "feat(penjualan): PPN snapshot, ship/return journals, tax UI"
```

---

### Task 6: Pembelian — receive/return PPN + UI

**Files:**
- Modify: `src/features/pembelian/pembelian-data.ts`
- Modify: `src/features/pembelian/PembelianContext.tsx`
- Modify: penerimaan + retur beli UI components

**Interfaces:**
- Receives: tax fields on confirm receive + post purchase return
- JE receive: Dr Inv `dpp`, Dr `ppnIn` `ppn`, Cr AP `total`
- JE return: Dr AP `total`, Cr Inv `dpp`, Cr `ppnIn` `ppn`

- [ ] **Step 1: Types + summarize**

Add `TaxSnapshotFields` to `Purchase` and `PurchaseReturn`.

`summarize`: `total = purchase.totalWithTax ?? (received ? weighing.netto * unitPrice : 0)`.

Extend receive / return action inputs with `ppnRate` + `priceMode` (and optional `supplierFakturNo` on receive).

- [ ] **Step 2: Replace pair journal on receive with multi-line**

Either extend `postPembelianJournal` to accept optional `ppn` + `ppnKey: 'ppnIn'` or add `postPembelianReceiveJournal`:

```ts
lines = [
  { accountId: mapAccount('inventoryGabah'), debit: dpp, credit: 0 },
  ...(ppn > 0
    ? [{ accountId: mapAccount('ppnIn'), debit: ppn, credit: 0 }]
    : []),
  { accountId: mapAccount('ap'), debit: 0, credit: total },
]
```

Payable upsert `amount: total` (with tax).

- [ ] **Step 3: Purchase return**

Same tax compute on credit subtotal; snapshot; `void` not needed on partial — new TaxDoc `purchaseReturn`.

Void PO: `voidTaxForSource('purchase', id)`.

- [ ] **Step 4: UI TaxPostFields on penerimaan confirm + retur post**

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/pembelian src/components/pembelian src/pages/modules/pembelian
git commit -m "feat(pembelian): PPN on receive/return and AP totals"
```

---

### Task 7: Biaya operasional PPN

**Files:**
- Modify: `src/features/keuangan/keuangan-data.ts` (`ExpenseRow` snapshot fields)
- Modify: `src/features/keuangan/finance-store.tsx` (`AddExpenseInput`, `addExpense`, `setExpenseStatus`)
- Modify: `src/pages/modules/keuangan/BiayaPage.tsx`

**Interfaces:**
- Post expense JE: Dr `expenseOps` dpp, Dr `ppnIn` ppn, Cr `cash` total
- Cash out amount = `totalWithTax`
- `recordTaxDoc` sourceType `expense`; void via `voidTaxForSource` when unpost

- [ ] **Step 1: Types**

`ExpenseRow` += TaxSnapshotFields. `AddExpenseInput` += `ppnRate`, `priceMode` (required when posting).

- [ ] **Step 2: Journal helper**

Replace `postAutoPairJournal` for expense with multi-line when posting:

```ts
const calc = computePpn({ subtotal: input.amount, rate, priceMode })
// cash amount = calc.total
// store snapshot on ExpenseRow
```

Unpost: reverse JE + `voidTaxForSource('expense', id)` + cash reverse using `totalWithTax ?? amount`.

- [ ] **Step 3: BiayaPage TaxPostFields**

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/keuangan/keuangan-data.ts src/features/keuangan/finance-store.tsx src/pages/modules/keuangan/BiayaPage.tsx
git commit -m "feat(keuangan): PPN on operational expenses"
```

---

### Task 8: e-Faktur page + nav + route

**Files:**
- Create: `src/pages/modules/keuangan/EFakturPage.tsx`
- Modify: `src/features/nav/nav-config.ts`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Route `/app/keuangan/e-faktur`, roles `admin` | `keuangan`
- List invoices, filter status, settings drawer (NPWP, prefix, defaults), Kirim mock (+ simulate fail), Export CSV download

- [ ] **Step 1: Page**

Use OpsChrome / FinanceTable patterns from JurnalPage:

- Table: number, date, party, dpp, ppn, total, status
- Detail drawer
- Button “Kirim mock” → ConfirmDialog with checkbox “Simulasikan gagal” → `sendInvoiceMock`
- “Export CSV” → `buildEfakturCsv` → download blob `efaktur-YYYYMMDD.csv`
- Header settings: NPWP, invoicePrefix, defaultRate, defaultPriceMode via `updateSettings`

- [ ] **Step 2: Nav + router**

nav-config after jurnal:

```ts
{
  id: 'e-faktur',
  label: 'e-Faktur',
  path: '/app/keuangan/e-faktur',
  roles: ['admin', 'keuangan'],
},
```

router:

```tsx
<Route path="e-faktur" element={<EFakturPage />} />
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/pages/modules/keuangan/EFakturPage.tsx src/features/nav/nav-config.ts src/app/router.tsx
git commit -m "feat(keuangan): e-Faktur list, mock send, CSV export"
```

---

### Task 9: DOMAIN.md + final verify

**Files:**
- Modify: `docs/DOMAIN.md`

- [ ] **Step 1: Document**

Add section for `TaxDoc` / `TaxInvoice` / `egabah.tax.v1`, AccountMap `ppnOut`/`ppnIn`, compute rules, dual-track total vs DPP, e-Faktur mock only. Remove “PPN / e-Faktur” from out-of-scope list for 2a (note 2b done; 2c still open).

- [ ] **Step 2: Manual checklist (from spek)**

1. tsc clean
2. Ship exclusive 11%: AR=total, sales=DPP, ppnOut=PPN; draft invoice appears
3. Ship 0%: no PPN line / no TaxInvoice
4. Inclusive 11%: DPP+PPN=input total
5. PO receive + expense with PPN: ppnIn; AP/cash=total
6. CSV download; mock send → sent; simulate fail → failed
7. Journal fail still toasts

- [ ] **Step 3: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add docs/DOMAIN.md
git commit -m "docs: DOMAIN TaxDoc, PPN journals, e-Faktur mock"
```

---

## Self-review (plan vs spek)

| Spek requirement | Task |
| --- | --- |
| `egabah.tax.v1` settings/docs/invoices | 1, 3 |
| `computePpn` exclusive/inclusive/0 | 1 |
| Snapshot on source docs + summarize totalWithTax | 5, 6, 7 |
| GL ppnOut/ppnIn seed + map UI | 2 |
| Ship/receive/expense/return journals | 5, 6, 7 |
| TaxInvoice on ship ppn>0 only | 3, 5 |
| Form TaxPostFields | 4, 5–7 |
| `/app/keuangan/e-faktur` + CSV + mock send | 8 |
| Void tax on void docs | 5–7 |
| DOMAIN | 9 |
| No DJP API / no backfill / no Vitest | Global constraints |

No placeholders left; types aligned (`PpnRate`, `totalWithTax`, `recordSaleInvoice`).
