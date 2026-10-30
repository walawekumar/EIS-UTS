# Task 7 report — WIP / production journals (fix pass)

**Branch:** `feat/accounting-gl-coa-journals`  
**Date:** 2026-10-30

## Findings addressed

### Critical — legacy complete must not credit WIP

**Issue:** `completeBatch` posted `batch:{id}:done` with Cr `wip` even when `wipStockPosted` was false (approved → done without `startBatch`), while stock used the legacy gabah-out path.

**Fix:** Post `batch:{id}:done` only when `doneBatch.wipStockPosted` is true. Legacy complete continues to use `postLegacyCompleteStock` only; no done journal.

### Important 1 — missing lot / zero grain

**Issue:** Done journal could still credit WIP using a fallback `grainValueForBatch` when `wipGrainValue` was unset.

**Fix:** Require stored `wipGrainValue > 0` before any done GL. If lot or purchase is missing at complete, skip done GL (LotCost may still persist separately when lot exists). No WIP credit without a prior start journal amount.

### Important 2 — Cr WIP vs Dr beras alignment

**Issue:** Cr `wip` used `wipGrainValue ?? grainValueForBatch(...)`, mixing fresh purchase grain with start-time WIP.

**Fix:** Cr `wip` uses **only** `doneBatch.wipGrainValue`. Dr `inventoryBeras` = `wipGrainValue + allocatedOps` so debits match credits (grain at start + proportional ops).

### Important 3 — seed / in-flight without flags

Legacy stock path unchanged; acceptable once done GL is gated on `wipStockPosted`.

## Verification

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Exit 0 after removing unused `lotCostTotal` import in `ProduksiContext.tsx`.

## Files changed

- `src/features/produksi/ProduksiContext.tsx` — `completeBatch` done journal gating and line amounts
