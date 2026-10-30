# Polish GL 2a — LotCost COGS + journal failure toasts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship/return COGS from explicit SO `lotId` → `LotCost.costPerKgBeras` (block if missing); surface auto-journal failures as page toasts while keeping `failedPosts` retry.

**Architecture:** Thin penjualan data + context changes for lot binding; pure `cogsAmountForLot` helper. Journal helpers return `postJournalEntry` errors to callers; pages already using `FinanceToast` show them. No Vitest in repo — verify with `npx tsc -p tsconfig.app.json --noEmit` and manual checks from the spec.

**Tech Stack:** React 19, Vite, Tailwind 4, localStorage (`egabah.penjualan.v1`, produksi lotCosts).

**Spec:** `docs/superpowers/specs/2026-10-30-gl-polish-lot-cogs-toast-design.md`

## Global Constraints

- No fallback to `costPrice` master for COGS.
- Block ship/return when lot/LotCost invalid — do not post stok/AR/journals partially for ship (validate **before** mutations).
- Dual-track: ops success + journal fail → toast + `failedPosts`; do not roll back ops after they succeeded.
- No PPN, e-Faktur, rekon, period lock, FIFO, multi-lot SO, Vitest suite.
- `npx tsc -p tsconfig.app.json --noEmit` clean after every task.
- Preserve FinanceToast / existing penjualan UI patterns.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/features/penjualan/penjualan-data.ts` | `SaleOrder.lotId?`, `DeliveryInput.lotId` |
| `src/features/penjualan/cogs-from-lot.ts` | Pure COGS helper from LotCost |
| `src/features/penjualan/PenjualanContext.tsx` | ship/return LotCost COGS; journal helpers return errors |
| `src/components/penjualan/PengirimanView.tsx` | Lot select on ship form |
| `src/features/pembelian/PembelianContext.tsx` | `postPembelianJournal` return error |
| `src/features/produksi/ProduksiContext.tsx` | prod journal helpers return error |
| `src/features/keuangan/finance-store.tsx` | `postAutoPairJournal` return error |
| `src/features/payroll/payroll-store.tsx` | payroll journal helper return error |
| Caller pages (toast) | Show journal error strings via existing toast |
| `docs/DOMAIN.md` | Document `lotId` + LotCost COGS |

---

### Task 0: Verify foundation

**Files:** none (read-only)

- [ ] **Step 1: Confirm 2a on main**

```bash
git branch --show-current
git log -1 --oneline
npx tsc -p tsconfig.app.json --noEmit
```

Expected: on `main` (or polish branch from main), HEAD includes GL; tsc exit 0.

- [ ] **Step 2: No commit** (verify only)

---

### Task 1: Types + pure COGS helper

**Files:**
- Modify: `src/features/penjualan/penjualan-data.ts`
- Create: `src/features/penjualan/cogs-from-lot.ts`

**Interfaces:**
- Produces: `SaleOrder.lotId?: string`, `DeliveryInput.lotId: string` (required at ship), `cogsAmountForLot(lotCosts, lotId, qty): { ok: true; amount: number } | { ok: false; error: string }`

- [ ] **Step 1: Extend types**

In `penjualan-data.ts`, add to `SaleOrder`:

```ts
lotId?: string
```

Add to `DeliveryInput`:

```ts
lotId: string
```

- [ ] **Step 2: Add helper**

Create `src/features/penjualan/cogs-from-lot.ts`:

```ts
import type { LotCost } from '@/features/produksi/produksi-data'

export function cogsAmountForLot(
  lotCosts: LotCost[],
  lotId: string | undefined,
  qty: number,
): { ok: true; amount: number } | { ok: false; error: string } {
  if (!lotId?.trim()) {
    return { ok: false, error: 'Pilih lot costing untuk pengiriman.' }
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: 'Qty tidak valid untuk COGS.' }
  }
  const cost = lotCosts.find((l) => l.lotId === lotId)
  if (!cost) {
    return { ok: false, error: `LotCost tidak ditemukan untuk lot ${lotId}.` }
  }
  if (!(cost.costPerKgBeras > 0)) {
    return {
      ok: false,
      error: `Lot ${lotId} belum punya cost per kg beras.`,
    }
  }
  return { ok: true, amount: qty * cost.costPerKgBeras }
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: may fail until callers pass `lotId` on `DeliveryInput` — if so, proceed immediately to Task 2 in same session **or** temporarily make `lotId` optional on `DeliveryInput` only until Task 2–3 land. Prefer: make `DeliveryInput.lotId: string` required and fix compile in Task 2–3 before committing Task 1 alone.

**Commit strategy:** Do **not** commit Task 1 alone if `DeliveryInput.lotId` breaks compile. Land Tasks 1–3 in one green commit (see Task 3 Step 4) or keep `lotId` required and finish Task 2–3 before any commit.

---

### Task 2: shipOrder + postSaleReturn use LotCost

**Files:**
- Modify: `src/features/penjualan/PenjualanContext.tsx`

**Interfaces:**
- Consumes: `cogsAmountForLot`, `useProduksi().lotCosts` (or read lotCosts from ProduksiContext — already available in app tree)
- Produces: `shipOrder` requires `input.lotId`; persists `next.lotId`; COGS from LotCost; `postSaleReturn` uses `order.lotId`

- [ ] **Step 1: Wire lotCosts into context**

In `PenjualanContext`, import `cogsAmountForLot` and obtain `lotCosts` via `useProduksi()` (same pattern as other cross-module hooks). Confirm `ProduksiProvider` wraps penjualan routes (already true in app).

- [ ] **Step 2: Change journal helpers to return errors**

Update `postPenjualanPairJournal`, `postPenjualanShipJournal`, `postPenjualanReturnJournal` from `: void` to `: string | undefined`, returning `postJournalEntry(...)` result (and `undefined` on early amount skip).

- [ ] **Step 3: Validate lot before ship mutations**

At start of `shipOrder`, after finding `current`:

```ts
const cogs = cogsAmountForLot(lotCosts, input.lotId, current.qty)
if (!cogs.ok) return cogs.error
```

Remove `unitCostForSku` usage for ship. Set `lotId: input.lotId` on `next`. Use `cogs.amount` in `postPenjualanShipJournal`. Collect journal errors:

```ts
const shipJeErr = postPenjualanShipJournal(...)
// after COD pair if any:
const codJeErr = isPaid ? postPenjualanPairJournal(...) : undefined
const jeErr = shipJeErr ?? codJeErr
// Prefer: still complete ship; return null for ops success BUT pages need toast for jeErr.
```

**Spec dual-track:** ops succeed even if JE fails. So `shipOrder` should **not** return JE error as ship failure (that would look like ship blocked). Instead:

- Option implemented: return `string | null` for **ops** errors only; expose JE via toast by having `shipOrder` return a richer result **or** set a module-level last error.

**Chosen (YAGNI):** Change return type to:

```ts
shipOrder: (id: string, input: DeliveryInput) => {
  error?: string       // ops block
  journalError?: string // toast only; ship succeeded
} | null  // prefer object always
```

Simpler for this codebase: keep `string | null` for ops errors; on success return `null` and accept that PengirimanView must call something else — **better:**

```ts
// Return type stays string | null for ops failures.
// On success, if journal failed, return a sentinel? NO — blocks closeWork incorrectly.

// Use: shipOrder returns string | null (ops).
// Add optional out-param pattern — avoid.

// FINAL: shipOrder returns `string | null` where:
// - ops failure → error string (no ship)
// - success → null
// Journal errors: append to a small callback or return `{ ok: true, journalWarning?: string }`.
```

**Implement this API:**

```ts
export type ShipOrderResult =
  | { ok: false; error: string }
  | { ok: true; journalError?: string }

shipOrder: (id: string, input: DeliveryInput) => ShipOrderResult
```

Update `PengirimanPage` / `PengirimanView` in Task 3 to toast `journalError` while treating `ok: true` as success.

- [ ] **Step 4: postSaleReturn**

Before stock/AR mutations:

```ts
if (!order.lotId) {
  return 'Order belum punya lot costing; tidak bisa post retur dengan COGS LotCost.'
}
const retQty = current.lines.reduce((s, l) => s + l.qty, 0)
const cogs = cogsAmountForLot(lotCosts, order.lotId, retQty)
if (!cogs.ok) return cogs.error
```

Use `cogs.amount` instead of `unitCostForSku`. After ops, if `postPenjualanReturnJournal` returns error, still complete post but surface toast from ReturPage — return `undefined` for ops success and either:

```ts
return journalError ? `Jurnal gagal: ${journalError}` : undefined
```

Spec: dual-track — prefer ops success + toast. Match ship: change `postSaleReturn` to return `{ ok: false; error } | { ok: true; journalError?: string }` **or** keep string where non-`Jurnal gagal:` prefix means hard fail. **Simplest aligned with ReturPage today (`setToast(err ?? ...)`):**

- Hard fail → return error string (no post)
- Soft JE fail → return `undefined` for stage update, and set toast via returning a second channel

Use same `ShipOrderResult`-shaped type renamed `ActionResult` for return post:

```ts
type PenjualanActionResult =
  | { ok: false; error: string }
  | { ok: true; journalError?: string }
```

Update ReturPage callers in Task 3/4.

- [ ] **Step 5: Remove dead `unitCostForSku` if unused**

- [ ] **Step 6: Typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Fix all call sites of `shipOrder` / `postSaleReturn` return types (Task 3 may absorb UI).

- [ ] **Step 7: Commit** (after Task 3 if UI still red)

```bash
git add src/features/penjualan/PenjualanContext.tsx
git commit -m "feat(penjualan): LotCost COGS on ship and sale return"
```

---

### Task 3: Pengiriman UI — lot select + result handling

**Files:**
- Modify: `src/components/penjualan/PengirimanView.tsx`
- Modify: `src/pages/modules/penjualan/PengirimanPage.tsx` (if needed)
- Possibly: `src/pages/modules/penjualan/ReturPage.tsx` for `postSaleReturn` result + show `order.lotId`

**Interfaces:**
- Consumes: `lotCosts` from `useProduksi()`, `ShipOrderResult` / `PenjualanActionResult`

- [ ] **Step 1: Lot field on ship form**

In `PengirimanView` work drawer/form state, add `lotId` string state. Render `<select>` of `lotCosts.filter(l => l.costPerKgBeras > 0)` with labels like `` `${l.lotId} · ${l.costPerKgBeras}/kg` ``. Validate non-empty before `onShip`.

Pass `lotId` in `DeliveryInput`.

- [ ] **Step 2: Handle `PenjualanActionResult`**

```ts
const result = onShip(work.id, input)
if (!result.ok) {
  setToast(result.error)
  return
}
if (result.journalError) {
  setToast(`Dikirim, tetapi jurnal gagal: ${result.journalError}`)
} else {
  setToast(/* existing success copy */)
}
closeWork()
```

Update `onShip` prop type accordingly in page wrapper.

- [ ] **Step 3: ReturPage**

On post success path, if result has `journalError`, toast it. Show read-only `order.lotId` on detail when present.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/components/penjualan/PengirimanView.tsx src/pages/modules/penjualan/PengirimanPage.tsx src/pages/modules/penjualan/ReturPage.tsx src/features/penjualan/PenjualanContext.tsx src/features/penjualan/penjualan-data.ts src/features/penjualan/cogs-from-lot.ts
git commit -m "feat(penjualan): lot picker on ship and LotCost COGS wiring"
```

---

### Task 4: Propagate journal errors + toasts (other modules)

**Files:**
- Modify: `src/features/pembelian/PembelianContext.tsx` — `postPembelianJournal` → `string | undefined`
- Modify: `src/features/produksi/ProduksiContext.tsx` — journal helpers → return error
- Modify: `src/features/keuangan/finance-store.tsx` — `postAutoPairJournal` → return error; expense/payroll callers toast if UI owns toast
- Modify: `src/features/payroll/payroll-store.tsx`
- Modify pages that already have `FinanceToast`: pembelian receive/pay/return views, BiayaPage, PayrollPage, produksi batch/pack views — after action, if journal error string available, `setToast`

**Pattern for context methods that today return `string | undefined` for ops:**

Keep ops error as now. For journal: if method returns only one string, use:

```ts
const je = postPembelianJournal(...)
if (je) {
  // ops already done — return undefined to mean ops ok, but pages need JE signal
}
```

**Consistent approach:** Where the page only has `const err = action(); setToast(err ?? success)`, change action to return `PenjualanActionResult`-equivalent:

```ts
type DualTrackResult =
  | { ok: false; error: string }
  | { ok: true; journalError?: string }
```

Apply to pembelian receive/pay/return and expense status toggle / payroll post if they currently return `string | undefined`. Minimize churn: **at minimum** ensure helpers return JE errors and the **primary** penjualan paths toast (Task 2–3). For other modules, bubble JE by appending to success toast inside the store/context via returning `DualTrackResult` on the hottest paths: receive purchase, add payment, post purchase return, setExpenseStatus posted, payroll postRun, completeBatch/startBatch.

- [ ] **Step 1: Helper return types**

Each `post*Journal` / `postAutoPairJournal` returns `string | undefined` from `postJournalEntry`.

- [ ] **Step 2: Call sites toast**

For each UI entry that already toasts, on `{ ok: true, journalError }` show `Jurnal gagal: …` while confirming ops success copy.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/pembelian/PembelianContext.tsx src/features/produksi/ProduksiContext.tsx src/features/keuangan/finance-store.tsx src/features/payroll/payroll-store.tsx src/pages/modules/keuangan/BiayaPage.tsx src/pages/modules/keuangan/PayrollPage.tsx
# plus any pembelian/produksi view files touched
git commit -m "feat(keuangan): surface auto-journal failures as page toasts"
```

---

### Task 5: DOMAIN.md

**Files:**
- Modify: `docs/DOMAIN.md`

- [ ] **Step 1: Document**

Under penjualan / GL sections:

- `SaleOrder.lotId` set at ship; required for LotCost COGS
- COGS = `qty * LotCost.costPerKgBeras`; no master `costPrice` fallback
- Sale return uses SO `lotId`
- Auto-journal failure → toast + `failedPosts` (dual-track)

- [ ] **Step 2: Commit**

```bash
git add docs/DOMAIN.md
git commit -m "docs: DOMAIN SaleOrder lotId and LotCost COGS"
```

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| `SaleOrder.lotId` / `DeliveryInput.lotId` | 1–3 |
| `cogsAmountForLot` / no costPrice fallback | 1–2 |
| Block ship without LotCost | 2–3 |
| Return COGS from SO lot | 2–3 |
| Journal helpers return errors | 2, 4 |
| Page toasts + failedPosts | 3–4 |
| DOMAIN | 5 |
| No PPN/FIFO/Vitest | Global |

## Execution

After plan approval, use subagent-driven-development (recommended) or executing-plans.
