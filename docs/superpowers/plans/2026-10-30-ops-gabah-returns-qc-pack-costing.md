# Ops Gabah Returns / QC / Pack / Costing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add purchase/sale returns, lot QC gate, post-milling pack/grading, and per-lot costing snapshots — still localStorage, no accounting journals.

**Architecture:** Extend existing pembelian/penjualan/produksi snapshots and contexts. Returns and pack runs use light stage machines; QC upserts by `lotId`; costing is a computed snapshot on complete/recalc. Finance gets credit helpers to shrink AP/AR amounts. UI follows OpsChrome + ConfirmDialog.

**Tech Stack:** React 19, React Router 7, Vite, Tailwind 4, localStorage repos. Verify with `npx tsc --noEmit` (no Vitest in repo).

**Spec:** `docs/superpowers/specs/2026-10-30-ops-gabah-returns-qc-pack-costing-design.md`

## Global Constraints

- No `window.confirm` / `prompt` / `alert` — use `ConfirmDialog` / `PromptDialog`.
- `npx tsc --noEmit` clean after every task.
- Gelombang 1 writes **no** COA/journals/PPN (gelombang 2).
- Soft-link docs (`purchaseId` / `orderId` / `lotId` / `batchId`); never hard-delete posted sources.
- Qty guards: return/pack cannot exceed remaining qty; reject with string error, no partial post.
- Preserve design tokens / Finance* / OpsChrome patterns.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/features/workflow/doc-stages.ts` | Shared `ReturnStage` + labels + migrate |
| `src/features/pembelian/pembelian-data.ts` | `PurchaseReturn`, `LotQc`, helpers |
| `src/features/pembelian/pembelian-storage.ts` | Snapshot `returns` + `lotQc` + migrate |
| `src/features/pembelian/PembelianContext.tsx` | Return/QC mutations + receive QC gate |
| `src/features/keuangan/finance-store.tsx` | `creditPayable` / `creditReceivable` |
| `src/features/penjualan/penjualan-data.ts` | `SaleReturn` + helpers |
| `src/features/penjualan/penjualan-storage.ts` | Snapshot `returns` |
| `src/features/penjualan/PenjualanContext.tsx` | Sale return mutations |
| `src/features/produksi/produksi-data.ts` | `PackRun`, `LotCost`, helpers |
| `src/features/produksi/produksi-storage.ts` | Snapshot `packRuns` + `lotCosts` |
| `src/features/produksi/ProduksiContext.tsx` | Pack post/void + costing recalc |
| `src/pages/modules/pembelian/ReturPage.tsx` | Purchase returns UI |
| `src/pages/modules/pembelian/QcPage.tsx` | Lot QC list/form |
| `src/pages/modules/penjualan/ReturPage.tsx` | Sale returns UI |
| `src/pages/modules/produksi/PackingPage.tsx` | Pack/grading UI |
| `src/components/pembelian/*` | QC gate on receive drawer |
| `src/components/produksi/RendemenView.tsx` | Costing columns |
| `src/pages/modules/LaporanPage.tsx` | Lot costing block |
| `src/features/nav/nav-config.ts` + `src/app/router.tsx` | Routes |
| `docs/DOMAIN.md` | Document entities |

---

### Task 0: Verify foundation (gelombang 0)

**Files:** none (read-only check)

- [ ] **Step 1: Confirm foundation on main**

Run:

```bash
git log --oneline -5
npx tsc --noEmit
```

Expected: recent commits include produksi/penjualan/master; `tsc` exit 0. If `tsc` fails, fix before Task 1.

- [ ] **Step 2: No commit** (verification only)

---

### Task 1: Shared return stage + pembelian return/QC types + storage migrate

**Files:**
- Create: `src/features/workflow/doc-stages.ts`
- Modify: `src/features/pembelian/pembelian-data.ts`
- Modify: `src/features/pembelian/pembelian-storage.ts`

**Interfaces:**
- Produces: `ReturnStage`, `RETURN_STAGE_LABEL`, `migrateReturnStage`, `PurchaseReturn`, `LotQc`, `returnedQtyForPurchase`, `nextPurchaseReturnId`, `upsertLotQc`, `getLotQc`

- [ ] **Step 1: Add shared stages**

```ts
// src/features/workflow/doc-stages.ts
export type ReturnStage =
  | 'draft'
  | 'diajukan'
  | 'disetujui'
  | 'posted'
  | 'ditolak'

export const RETURN_STAGE_LABEL: Record<ReturnStage, string> = {
  draft: 'Draft',
  diajukan: 'Diajukan',
  disetujui: 'Disetujui',
  posted: 'Posted',
  ditolak: 'Ditolak',
}

export function migrateReturnStage(raw: string): ReturnStage {
  if (raw in RETURN_STAGE_LABEL) return raw as ReturnStage
  return 'draft'
}
```

- [ ] **Step 2: Extend pembelian-data types**

Add (exact names):

```ts
import type { ApprovalStamp } from '@/features/workflow/approvals'
import type { ReturnStage } from '@/features/workflow/doc-stages'

export type PurchaseReturnLine = { sku: string; productName: string; unit: string; qty: number }

export type PurchaseReturn = {
  id: string
  purchaseId: string
  lotId?: string
  lines: PurchaseReturnLine[]
  reason: string
  stage: ReturnStage
  approvals?: ApprovalStamp[]
  createdAt: string
  postedAt?: string
  rejectedReason?: string
}

export type LotQcGrade = 'A' | 'B' | 'C' | 'reject'

export type LotQc = {
  lotId: string
  purchaseId: string
  moisture: number
  impurity: number
  brokenPct: number
  grade: LotQcGrade
  passed: boolean
  note?: string
  by: string
  at: string
  overrideReason?: string
}

export function returnedQtyForPurchase(
  returns: PurchaseReturn[],
  purchaseId: string,
  sku: string,
): number {
  return returns
    .filter((r) => r.purchaseId === purchaseId && r.stage === 'posted')
    .flatMap((r) => r.lines)
    .filter((l) => l.sku === sku)
    .reduce((s, l) => s + l.qty, 0)
}

export function nextPurchaseReturnId(returns: PurchaseReturn[]): string {
  const n = returns.length + 1
  return `PR-${String(n).padStart(4, '0')}`
}
```

- [ ] **Step 3: Migrate pembelian storage**

```ts
export type PembelianSnapshot = {
  version: 1
  purchases: Purchase[]
  returns: PurchaseReturn[]
  lotQc: LotQc[]
  updatedAt: string
}

function normalize(snapshot: PembelianSnapshot): PembelianSnapshot {
  return {
    ...snapshot,
    returns: (snapshot.returns ?? []).map((r) => ({
      ...r,
      stage: migrateReturnStage(String(r.stage)),
    })),
    lotQc: snapshot.lotQc ?? [],
    purchases: snapshot.purchases.map((p) => ({
      ...p,
      stage: migratePurchaseStage(String(p.stage)),
    })),
  }
}

function isValid(value: unknown): value is PembelianSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as PembelianSnapshot
  return v.version === 1 && Array.isArray(v.purchases)
  // returns/lotQc optional on disk → normalize fills []
}
```

Update `seed()` to include `returns: []`, `lotQc: []`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/doc-stages.ts src/features/pembelian/pembelian-data.ts src/features/pembelian/pembelian-storage.ts
git commit -m "feat(pembelian): return and lot QC types with storage migrate"
```

---

### Task 2: Finance credit helpers

**Files:**
- Modify: `src/features/keuangan/keuangan-data.ts` (status recalc helper if needed)
- Modify: `src/features/keuangan/finance-store.tsx`

**Interfaces:**
- Produces: `creditPayable(invoice: string, amount: number): void`, `creditReceivable(invoice: string, amount: number): void`
- Behavior: decrease `amount` by `credit` (min floor = `paid`); recompute status open/partial/paid; no-op if invoice missing

- [ ] **Step 1: Implement helpers on FinanceProvider**

```ts
const creditPayable = useCallback((invoice: string, credit: number) => {
  if (credit <= 0) return
  setPayables((list) =>
    list.map((row) => {
      if (row.invoice !== invoice) return row
      const amount = Math.max(row.paid, row.amount - credit)
      const status =
        row.paid >= amount ? 'paid' : row.paid > 0 ? 'partial' : 'open'
      return { ...row, amount, status }
    }),
  )
}, [])

const creditReceivable = useCallback((invoice: string, credit: number) => {
  if (credit <= 0) return
  setReceivables((list) =>
    list.map((row) => {
      if (row.invoice !== invoice) return row
      const amount = Math.max(row.paid, row.amount - credit)
      const status =
        row.paid >= amount ? 'paid' : row.paid > 0 ? 'partial' : 'open'
      return { ...row, amount, status }
    }),
  )
}, [])
```

Expose both on context value.

- [ ] **Step 2: Verify** `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/features/keuangan/finance-store.tsx src/features/keuangan/keuangan-data.ts
git commit -m "feat(keuangan): credit payable and receivable for returns"
```

---

### Task 3: PembelianContext — returns + QC + receive gate

**Files:**
- Modify: `src/features/pembelian/PembelianContext.tsx`
- Modify: receive path that posts stock (existing `confirmReceive` / equivalent)

**Interfaces:**
- Consumes: `creditPayable`, `addMovement`, `appendAudit`, types from Task 1
- Produces context API:
  - `returns: PurchaseReturn[]`
  - `lotQc: LotQc[]`
  - `createPurchaseReturn(...)`, `submitPurchaseReturn`, `approvePurchaseReturn`, `rejectPurchaseReturn`, `postPurchaseReturn`
  - `upsertLotQc(input)`, `overrideLotQcReceive(lotId, reason)`

- [ ] **Step 1: Persist returns/lotQc in existing load/save effect** alongside purchases.

- [ ] **Step 2: Implement return workflow**

Guards:
- create/edit only `draft`/`ditolak`; lines qty ≤ purchase received qty − `returnedQtyForPurchase`
- submit: pembelian|admin → `diajukan`
- approve: keuangan|admin → `disetujui`
- reject: keuangan|admin → `ditolak` + reason via PromptDialog caller
- post: keuangan|admin → stock `out` per line; `creditPayable(purchase.invoice or id, value)`; stage `posted`; audit `return`

Value for AP credit = sum(line.qty × effective unit price from purchase).

- [ ] **Step 3: QC upsert + receive gate**

Before existing receive/complete that moves stock:

```ts
const qc = lotQc.find((q) => q.lotId === purchase.lotId)
if (purchase.lotId) {
  if (!qc) return 'QC lot belum diisi.'
  if (!qc.passed && !qc.overrideReason) {
    return 'QC lot belum lulus — perlu override admin.'
  }
}
```

`upsertLotQc`: pembelian|gudang|admin.  
Set `overrideReason` only as admin when forcing receive.

- [ ] **Step 4: Verify** `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/features/pembelian/PembelianContext.tsx
git commit -m "feat(pembelian): return workflow, lot QC, receive gate"
```

---

### Task 4: Pembelian UI — Retur + QC pages, nav, receive drawer

**Files:**
- Create: `src/pages/modules/pembelian/ReturPage.tsx`
- Create: `src/pages/modules/pembelian/QcPage.tsx`
- Modify: `src/app/router.tsx` (routes `retur`, `qc` under pembelian)
- Modify: `src/features/nav/nav-config.ts`
- Modify: receive UI (e.g. `PenerimaanView.tsx`) to show QC status + override confirm

**Interfaces:**
- Consumes context API from Task 3

- [ ] **Step 1: Add nav items**

```ts
{ id: 'pembelian-retur', label: 'Retur', path: '/app/pembelian/retur', roles: ['admin', 'pembelian', 'keuangan'] },
{ id: 'pembelian-qc', label: 'QC Lot', path: '/app/pembelian/qc', roles: ['admin', 'pembelian', 'gudang'] },
```

- [ ] **Step 2: ReturPage** — list + drawer create/submit/approve/post using OpsChrome/FinanceTable patterns; ConfirmDialog on post.

- [ ] **Step 3: QcPage** — list lots from purchases with `lotId`; form moisture/impurity/broken/grade/passed; save via `upsertLotQc`.

- [ ] **Step 4: Penerimaan** — badge QC; if fail, admin-only override PromptDialog → set override then receive.

- [ ] **Step 5: Verify** `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/pages/modules/pembelian/ReturPage.tsx src/pages/modules/pembelian/QcPage.tsx src/app/router.tsx src/features/nav/nav-config.ts src/components/pembelian/
git commit -m "feat(pembelian): retur and QC lot UI"
```

---

### Task 5: Sale return types, storage, context

**Files:**
- Modify: `src/features/penjualan/penjualan-data.ts`
- Modify: `src/features/penjualan/penjualan-storage.ts`
- Modify: `src/features/penjualan/PenjualanContext.tsx`

**Interfaces:**
- Produces: `SaleReturn`, `returnedQtyForOrder`, `nextSaleReturnId`
- Context: `returns`, `createSaleReturn`, `submitSaleReturn`, `approveSaleReturn`, `rejectSaleReturn`, `postSaleReturn`

Mirror purchase return stages. Post: stock `in`; `creditReceivable(order invoice id, value)`; only from orders `stage === 'dikirim'`. Roles: ajukan penjualan|admin; approve/post keuangan|admin.

- [ ] **Step 1: Types + `PenjualanSnapshot.returns` migrate** (same pattern as pembelian).

- [ ] **Step 2: Context mutations + audit**

- [ ] **Step 3: Verify** `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/features/penjualan/
git commit -m "feat(penjualan): sale return workflow"
```

---

### Task 6: Sale return UI

**Files:**
- Create: `src/pages/modules/penjualan/ReturPage.tsx`
- Modify: `src/app/router.tsx`, `src/features/nav/nav-config.ts`
- Optional: action on Tagihan/Order views to deep-link retur

- [ ] **Step 1: Nav** `{ id: 'penjualan-retur', label: 'Retur', path: '/app/penjualan/retur', roles: ['admin', 'penjualan', 'keuangan'] }`

- [ ] **Step 2: Page** list/drawer parallel to pembelian retur

- [ ] **Step 3: Verify** `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/pages/modules/penjualan/ReturPage.tsx src/app/router.tsx src/features/nav/nav-config.ts
git commit -m "feat(penjualan): retur UI"
```

---

### Task 7: PackRun + LotCost data/storage/context

**Files:**
- Modify: `src/features/produksi/produksi-data.ts`
- Modify: `src/features/produksi/produksi-storage.ts`
- Modify: `src/features/produksi/ProduksiContext.tsx`

**Interfaces:**
- Produces:
```ts
export type PackRunLine = {
  sku: string
  productName: string
  unit: string
  grade?: 'A' | 'B' | 'C'
  qty: number
  bags?: number
  location: string
}

export type PackRun = {
  id: string
  batchId: string
  sourceSku: string
  lines: PackRunLine[]
  stage: 'draft' | 'posted'
  createdAt: string
  postedAt?: string
  voidedAt?: string
}

export type LotCost = {
  lotId: string
  batchId: string
  grainValue: number
  allocatedOps: number
  berasQty: number
  costPerKgBeras: number
  method: 'manual' | 'proportional'
  at: string
}

export function computeLotCost(input: {
  grainValue: number
  allocatedOps: number
  berasQty: number
  method: 'manual' | 'proportional'
  lotId: string
  batchId: string
}): LotCost
```

- [ ] **Step 1: Extend `ProduksiSnapshot`** with `packRuns: PackRun[]`, `lotCosts: LotCost[]`; normalize defaults `[]`.

- [ ] **Step 2: `postPackRun`** — verify batch `done`, source stock available via persediaan balances (or optimistic movement); movements out source / in lines; stage posted; audit.

- [ ] **Step 3: `voidPackRun`** — reverse movements; set `voidedAt`.

- [ ] **Step 4: `recalcLotCost(batchId, opts)`** — resolve lot from batch input note/`lotId` field if present; grainValue from matching purchase; berasQty from outputs where name/sku indicates beras (use existing rendemen helper); write/replace `LotCost` snapshot. Call from `completeBatch` after stock post.

- [ ] **Step 5: Verify** `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/features/produksi/
git commit -m "feat(produksi): pack runs and lot costing snapshots"
```

---

### Task 8: Packing UI + rendemen costing columns

**Files:**
- Create: `src/pages/modules/produksi/PackingPage.tsx`
- Modify: `src/components/produksi/RendemenView.tsx` (or equivalent)
- Modify: `src/app/router.tsx`, `src/features/nav/nav-config.ts`

- [ ] **Step 1: Nav** `{ id: 'batch-packing', label: 'Packing', path: '/app/produksi/packing', roles: ['admin', 'produksi'] }`

- [ ] **Step 2: PackingPage** — select done batch + source SKU; edit lines; post/void with ConfirmDialog

- [ ] **Step 3: RendemenView** — show `costPerKgBeras` + rank by cost ascending optional toggle

- [ ] **Step 4: Verify** `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/pages/modules/produksi/PackingPage.tsx src/components/produksi/RendemenView.tsx src/app/router.tsx src/features/nav/nav-config.ts
git commit -m "feat(produksi): packing UI and costing on rendemen"
```

---

### Task 9: Laporan costing block + DOMAIN

**Files:**
- Modify: `src/pages/modules/LaporanPage.tsx`
- Modify: `docs/DOMAIN.md`

- [ ] **Step 1: Laporan** — section “Costing & rendemen per lot” table from `lotCosts` (+ join batch/purchase labels)

- [ ] **Step 2: DOMAIN.md** — document PurchaseReturn, SaleReturn, LotQc, PackRun, LotCost stages and stock/AP/AR effects; note no journals yet

- [ ] **Step 3: Full acceptance checklist**

Manual (against spec):
1. Retur beli posts → stock down, AP amount down
2. Retur jual posts → stock up, AR amount down
3. QC missing/fail blocks receive; admin override audited
4. Pack moves stock to kemasan SKUs
5. Costing appears on rendemen + laporan
6. No native confirm/prompt

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/pages/modules/LaporanPage.tsx docs/DOMAIN.md
git commit -m "docs: DOMAIN returns QC pack costing; laporan lot costs"
```

---

## Spec coverage check

| Spec item | Task |
| --- | --- |
| Gelombang 0 verify | 0 |
| PurchaseReturn + storage | 1, 3, 4 |
| SaleReturn + storage | 5, 6 |
| LotQc + receive gate | 1, 3, 4 |
| PackRun | 7, 8 |
| LotCost + laporan/rendemen | 7, 8, 9 |
| Roles / ConfirmDialog | 3–8 |
| No journals | Global constraint |
| DOMAIN | 9 |

## Placeholder / consistency review

- Types use `ReturnStage` / `PurchaseReturn` / `SaleReturn` / `LotQc` / `PackRun` / `LotCost` consistently.
- Finance APIs: `creditPayable` / `creditReceivable` only.
- Verify command everywhere: `npx tsc --noEmit`.
