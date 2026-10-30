# Approval Binding + Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pembelian↔keuangan binding (invoice on submit → approve → receive → selesai), payroll dual-approve before payout with transfer proof, uniform list UX on Payroll, and whole-app mobile responsive shell.

**Architecture:** Shared pure helpers in `src/features/workflow/` (`ApprovalStamp`, migrate helpers). Extend `Purchase` / `PayrollRun` stage machines and gate mutations in context/store by role + required proofs. UI reuses `ReceiptUpload`, `ConfirmDialog`/`PromptDialog`, `FinanceFilterBar`. Responsive via off-canvas sidebar + stacked filters.

**Tech Stack:** React 19, React Router 7, Vite, Tailwind 4, localStorage repositories. No Vitest yet — verify with `npx tsc --noEmit` + manual acceptance from the spec.

**Spec:** `docs/superpowers/specs/2026-10-30-approval-binding-responsive-design.md`

## Global Constraints

- Dual stamp payroll: admin stamp ≠ keuangan stamp; one user cannot fill both.
- Ajukan pembelian wajib `invoiceProof`; selesai wajib `purchaseProof`; bayar/cair wajib `transferProof`.
- No new `window.confirm` / `prompt` / `alert`.
- `tsc --noEmit` must stay clean after each task.
- Preserve existing design tokens / Finance* patterns.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/features/workflow/approvals.ts` | ApprovalStamp + helpers |
| `src/features/workflow/proof.ts` | ProofAttachment type alias + `hasProof` |
| `src/features/pembelian/pembelian-data.ts` | New stages, proof fields, migrate, labels |
| `src/features/pembelian/PembelianContext.tsx` | Stage transitions + role gates |
| `src/components/pembelian/*` | UI ajukan/approve/selesai + invoice upload |
| `src/features/nav/nav-config.ts` | Keuangan akses baca/approve pembelian |
| `src/features/payroll/payroll-data.ts` | New statuses + approvals + transferProof |
| `src/features/payroll/payroll-store.tsx` | Dual approve + post with proof |
| `src/pages/modules/keuangan/PayrollPage.tsx` | Filter/sort/pager + approve/cair UI |
| `src/features/notifikasi/build-notifications.ts` | Pending approve / selesai / payroll |
| `src/components/layout/AppShell.tsx` + `AppSidebar.tsx` + `AppTopbar.tsx` | Mobile drawer |
| `src/components/keuangan/FinanceFilterBar.tsx` | Stack on mobile |
| `docs/DOMAIN.md` | Document new machines |

---

### Task 1: Workflow helpers

**Files:**
- Create: `src/features/workflow/approvals.ts`
- Create: `src/features/workflow/proof.ts`

**Interfaces:**
- Produces: `ApprovalStamp`, `hasApproval`, `upsertApproval`, `clearApprovals`, `ProofAttachment`, `hasProof`

- [ ] **Step 1: Add approvals helper**

```ts
// src/features/workflow/approvals.ts
import type { Role } from '@/types/auth' // or local union matching Role

export type ApprovalStamp = {
  role: 'admin' | 'keuangan' | 'pembelian' | 'penjualan' | 'produksi' | 'gudang'
  by: string
  at: string
  note?: string
}

export function hasApproval(
  list: ApprovalStamp[] | undefined,
  role: ApprovalStamp['role'],
): boolean {
  return Boolean(list?.some((a) => a.role === role))
}

export function upsertApproval(
  list: ApprovalStamp[] | undefined,
  stamp: ApprovalStamp,
): ApprovalStamp[] {
  const prev = list ?? []
  return [...prev.filter((a) => a.role !== stamp.role), stamp]
}

export function clearApprovals(): ApprovalStamp[] {
  return []
}
```

- [ ] **Step 2: Add proof helper**

```ts
// src/features/workflow/proof.ts
export type ProofAttachment = {
  name: string
  size?: number
  mime?: string
  previewUrl?: string
}

export function hasProof(
  proof: ProofAttachment | string | null | undefined,
): boolean {
  if (!proof) return false
  if (typeof proof === 'string') return proof.trim().length > 0
  return proof.name.trim().length > 0
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/features/workflow
git commit -m "feat(workflow): approval and proof helpers"
```

---

### Task 2: Pembelian data model + migrate

**Files:**
- Modify: `src/features/pembelian/pembelian-data.ts`
- Modify: `src/features/pembelian/pembelian-storage.ts` (migrate on load if present)

**Interfaces:**
- Consumes: `ProofAttachment`, `ApprovalStamp`
- Produces: `PurchaseStage` new union; `migratePurchaseStage`; fields `invoiceProof?`, `purchaseProof?`, `approvals?`, `rejectReason?`

- [ ] **Step 1: Replace stage union and labels**

```ts
export type PurchaseStage =
  | 'draft'
  | 'diajukan'
  | 'disetujui'
  | 'ditolak'
  | 'ditimbang'
  | 'menunggu_selesai'
  | 'selesai'

export const STAGE_LABEL: Record<PurchaseStage, string> = {
  draft: 'Draft',
  diajukan: 'Menunggu approve',
  disetujui: 'Disetujui keuangan',
  ditolak: 'Ditolak',
  ditimbang: 'Ditimbang',
  menunggu_selesai: 'Menunggu selesai',
  selesai: 'Selesai',
}

export function migratePurchaseStage(raw: string): PurchaseStage {
  if (raw === 'dicatat') return 'diajukan'
  if (raw === 'diterima') return 'selesai'
  if (
    raw === 'draft' ||
    raw === 'diajukan' ||
    raw === 'disetujui' ||
    raw === 'ditolak' ||
    raw === 'ditimbang' ||
    raw === 'menunggu_selesai' ||
    raw === 'selesai'
  )
    return raw
  return 'draft'
}
```

- [ ] **Step 2: Extend `Purchase` type**

Add optional: `invoiceProof?: ProofAttachment | string`, `purchaseProof?: ProofAttachment | string`, `approvals?: ApprovalStamp[]`, `rejectReason?: string`, `budgetApprovedAt?: string`, `completedAt?: string`.  
Keep `voidedAt`. Update `summarize` / payment helpers that branch on `stage === 'diterima'` → treat `menunggu_selesai` | `selesai` as “received for AP/stock”.

- [ ] **Step 3: Migrate SEED + load path**

Map every seed `stage` through `migratePurchaseStage`. In storage load: `purchases.map(p => ({...p, stage: migratePurchaseStage(p.stage)}))`.

- [ ] **Step 4: Fix all TS references to old stages**

Grep `dicatat|diterima` under `src/` and update status pills, filters, void guards (`void` from ditimbang|menunggu_selesai|selesai; hard-delete only `draft`|`ditolak`).

- [ ] **Step 5: Verify + commit**

```bash
npx tsc --noEmit
git add src/features/pembelian src/components/pembelian src/pages/modules/pembelian
git commit -m "feat(pembelian): new approval stages and migrate"
```

---

### Task 3: PembelianContext transitions + role gates

**Files:**
- Modify: `src/features/pembelian/PembelianContext.tsx`

**Interfaces:**
- Consumes: `hasApproval`, `upsertApproval`, `hasProof`, `useAuth`
- Produces: `submitPurchase`, `approvePurchase`, `rejectPurchase`, `markPurchaseComplete` (+ existing weigh/confirm/pay gated)

- [ ] **Step 1: Create starts as `draft`**

`addPurchase` / create → `stage: 'draft'`.

- [ ] **Step 2: `submitPurchase(id)`**

Require role `pembelian|admin`. Require `hasProof(invoiceProof)` else throw/return error string. Set `stage: 'diajukan'`.

- [ ] **Step 3: `approvePurchase` / `rejectPurchase`**

Role `keuangan|admin`. Approve → `disetujui` + stamp keuangan or admin as `role: 'keuangan'` only when `user.role === 'keuangan'`; if admin approving anggaran, stamp `role: 'admin'` (anggaran approve = either role per spec). Spec table: Approve by `keuangan` or `admin` — stamp with **actor's actual role**. Set `budgetApprovedAt`. Reject → `ditolak` + `rejectReason` (required).

- [ ] **Step 4: Gate weigh / confirm**

`saveWeighing` / `confirmWeighing` only if `stage === 'disetujui'` (weigh) or after weigh path: confirm sets `menunggu_selesai` (not selesai), still creates stock + AP like today. Require `purchaseProof` can be attached at confirm or before complete.

- [ ] **Step 5: `completePurchase(id)`**

Role `keuangan|admin`. Require `hasProof(purchaseProof)`. Set `selesai` + `completedAt`.

- [ ] **Step 6: `applyPurchasePayment`**

Require `hasProof(transferProof)` on payment payload (add field to payment args). Role prefer `keuangan|admin`.

- [ ] **Step 7: Verify + commit**

```bash
npx tsc --noEmit
git commit -m "feat(pembelian): gate submit/approve/complete/pay by role and proof"
```

---

### Task 4: Pembelian UI (invoice, approve, selesai)

**Files:**
- Modify: `src/components/pembelian/PurchaseFormDrawer.tsx`
- Modify: `src/components/pembelian/PencatatanView.tsx`
- Modify: `src/components/pembelian/PenerimaanView.tsx`
- Modify: `src/components/pembelian/PembayaranView.tsx`
- Modify: `src/components/pembelian/StatusLabel.tsx`
- Modify: `src/features/nav/nav-config.ts` — add `keuangan` to pembelian paths (pencatatan + penerimaan) so they can approve/selesai
- Modify: `src/features/notifikasi/build-notifications.ts`

- [ ] **Step 1: Form draft + Invoice upload**

On create/edit draft: `ReceiptUpload` labeled **Invoice pemasok** bound to `invoiceProof`. Button **Ajukan ke keuangan** calls `submitPurchase`; show error toast if no invoice.

- [ ] **Step 2: Keuangan actions in drawer**

If `diajukan` and role keuangan|admin: show invoice preview/name, **Setujui** / **Tolak** (`PromptDialog` for reason).

- [ ] **Step 3: Penerimaan / selesai**

After `disetujui`: enable weigh. Confirm receive → `menunggu_selesai` + upload **Struk beli** (`purchaseProof`). Keuangan sees **Nyatakan selesai** when `menunggu_selesai` + proof present.

- [ ] **Step 4: Pembayaran**

Require transfer proof upload before confirm pay; block with toast if missing.

- [ ] **Step 5: Notifications**

Emit items for `diajukan` (keuangan), `menunggu_selesai` (keuangan), `ditolak` (pembelian).

- [ ] **Step 6: Verify + commit**

```bash
npx tsc --noEmit
git commit -m "feat(pembelian): invoice on submit and finance complete UI"
```

---

### Task 5: Payroll dual-approve + transfer proof + list UX

**Files:**
- Modify: `src/features/payroll/payroll-data.ts`
- Modify: `src/features/payroll/payroll-store.tsx`
- Modify: `src/pages/modules/keuangan/PayrollPage.tsx`
- Modify: `src/features/notifikasi/build-notifications.ts`

**Interfaces:**
- Status: `draft | menunggu_approve | siap_cair | posted | void`
- Fields: `approvals: ApprovalStamp[]`, `transferProof?`, `mutationNote?`
- Methods: `submitForApproval`, `approveAsAdmin`, `approveAsKeuangan`, `postRun(id, proof)`, `updateDraft` resets approvals when lines change after submit

- [ ] **Step 1: Data + migrate**

```ts
export function migratePayrollStatus(raw: string): PayrollStatus {
  if (raw === 'posted' || raw === 'void' || raw === 'draft') return raw as PayrollStatus
  if (raw === 'menunggu_approve' || raw === 'siap_cair') return raw
  return 'draft'
}
```

Seed posted runs: synthesize `approvals` with admin + keuangan stamps.

- [ ] **Step 2: Store gates**

```ts
function refreshReady(run: PayrollRun): PayrollRun {
  const ready =
    hasApproval(run.approvals, 'admin') && hasApproval(run.approvals, 'keuangan')
  if (run.status === 'menunggu_approve' && ready) {
    return { ...run, status: 'siap_cair' }
  }
  return run
}

// approveAsAdmin: only if user.role === 'admin'; stamp role 'admin'
// approveAsKeuangan: only if user.role === 'keuangan'; stamp role 'keuangan'
// postRun: require status === 'siap_cair' && hasProof(transferProof)
```

Material edit while awaiting → `clearApprovals`, status back to `draft` (ConfirmDialog).

- [ ] **Step 3: PayrollPage UX**

Add `FinanceFilterBar` (search name/id, filter status), `FinanceTable` sort, `FinancePager`. Drawer: approve buttons by role, `ReceiptUpload` for transfer before **Cairkan**, locked fields when posted/void.

- [ ] **Step 4: Notifications** for menunggu_approve / siap_cair.

- [ ] **Step 5: Verify + commit**

```bash
npx tsc --noEmit
git commit -m "feat(payroll): dual approve, transfer proof, list filters"
```

---

### Task 6: Responsive shell + filter stacking

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/components/layout/AppTopbar.tsx`
- Modify: `src/components/keuangan/FinanceFilterBar.tsx`
- Modify: `src/components/keuangan/FinanceStatGrid.tsx` (1-col mobile if not already)
- Modify: `src/components/layout/ModuleTabs.tsx` (overflow-x)

- [ ] **Step 1: Sidebar drawer state**

Lift `mobileNavOpen` in `AppShell`. Pass to sidebar/topbar. Below `md`: sidebar `fixed inset-y-0 left-0 z-40 w-[240px] -translate-x-full` → `translate-x-0` when open; overlay `bg-ink/40` closes on click. Desktop: static as today.

- [ ] **Step 2: Hamburger in AppTopbar**

Button visible `md:hidden`, `aria-label="Menu"`, toggles open.

- [ ] **Step 3: Close on navigate**

`NavLink` onClick → close mobile nav.

- [ ] **Step 4: FinanceFilterBar**

Root: `flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end`. Controls `w-full sm:w-auto`.

- [ ] **Step 5: Main padding**

`px-3 sm:px-5` on main.

- [ ] **Step 6: Verify + commit**

```bash
npx tsc --noEmit
git commit -m "feat(layout): mobile sidebar drawer and stacked filters"
```

---

### Task 7: DOMAIN.md + acceptance sweep

**Files:**
- Modify: `docs/DOMAIN.md`

- [ ] **Step 1: Document** pembelian stages, payroll dual-stamp, proof table, nav keuangan→pembelian.

- [ ] **Step 2: Grep natives**

```bash
rg "window\.(confirm|prompt|alert)" src
```

Expected: no hits (or only comments).

- [ ] **Step 3: Manual acceptance** (dev server)

1. Login pembelian → buat draft tanpa invoice → Ajukan gagal.  
2. Upload invoice → diajukan.  
3. Login keuangan → lihat invoice → Setujui.  
4. Pembelian timbang+struk → menunggu_selesai → keuangan Selesai.  
5. Payroll: admin approve + keuangan approve (dua login) → upload transfer → cair.  
6. Admin alone cannot double-stamp keuangan.  
7. Resize 375px: hamburger opens nav; tables scroll inside card.

- [ ] **Step 4: Final commit**

```bash
git add docs/DOMAIN.md
git commit -m "docs: DOMAIN approval binding and proofs"
```

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| ApprovalStamp helpers | 1 |
| invoiceProof on ajukan | 2–4 |
| purchaseProof / selesai | 3–4 |
| transferProof pay/cair | 3–5 |
| Pembelian stage machine | 2–4 |
| Payroll dual approve | 5 |
| Payroll filter/sort/pager | 5 |
| Notifications | 4–5 |
| Responsive shell | 6 |
| DOMAIN.md | 7 |
| No native dialogs | 7 |
| Keuangan can approve PO | 4 (nav) |
