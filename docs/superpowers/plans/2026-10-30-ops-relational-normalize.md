# Ops Relational Normalize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ops_docs` JSONB document store with ~30 typed Postgres tables (header + child) for all 10 ops modules, migrate existing rows, and rewire app repositories—without changing UI/Context business logic.

**Architecture:** New `cloud-relational` layer mirrors today’s ops_docs cache/hydrate/debounce/flush, but persists to named tables via row↔TS mappers. One SQL migration creates tables + RLS (`auth_can_write_module`), copies from `ops_docs`, then drops `ops_docs` / empty `app_module_snapshots` after verify. Storages keep snapshot `load`/`save` API via `createRelationalBackedRepository`.

**Tech Stack:** Vite/React/TS, Supabase JS client, Postgres RLS, existing `cloud-persist-bus`, `psql` via `DATABASE_URL` in `.env.local`.

**Spec:** `docs/superpowers/specs/2026-10-30-ops-relational-normalize-design.md`

## Global Constraints

- Soft FK only (`text` ids); no hard FK to `products`/`partners`/`profiles` in this wave.
- Nested domain arrays → child tables; small objects (`weighing`, `approvals`, proofs, tax snapshot, audit before/after) → `jsonb` columns on header.
- RLS: SELECT for `authenticated`; writes via `auth_can_write_module('<module>')`.
- UI/Context unchanged; only storage + gate + Auth flush.
- No new unit-test framework (repo has none); verify with `tsc`, SQL counts, and smoke CRUD.
- Do not commit unless the user asks; plan commit steps are optional checkpoints.
- Cutover is big-bang (all modules together) after migration applied on Supabase.

---

## File map

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20261030_ops_relational.sql` | CREATE tables, indexes, RLS, COPY from `ops_docs`, DROP legacy |
| `src/lib/cloud-relational.ts` | Cache, hydrate, schedule save, flush for named tables |
| `src/lib/relational-backed-repository.ts` | Snapshot repo adapter (replace ops-docs-backed) |
| `src/lib/ops-relational/types.ts` | Table name union + hydrate spec list |
| `src/lib/ops-relational/mappers/*.ts` | row↔doc + expand/collapse children per module |
| `src/features/*/…-storage.ts` | Switch to relational-backed repo |
| `src/features/cloud/OpsCloudGate.tsx` | Hydrate relational specs |
| `src/features/auth/AuthContext.tsx` | Flush relational pending saves |
| Delete after cutover | `cloud-ops-docs.ts`, `ops-docs-backed-repository.ts` (if unused); stop using snapshot hydrate |

---

### Task 1: Shared relational persist bus

**Files:**
- Create: `src/lib/ops-relational/types.ts`
- Create: `src/lib/cloud-relational.ts`
- Create: `src/lib/relational-backed-repository.ts`
- Modify: none yet (gate in Task 8)

**Interfaces:**
- Produces: `OpsTableName`, `ALL_RELATIONAL_HYDRATE_SPECS`, `isRelationalEnabled()`, `hydrateRelationalTables(specs)`, `getRelationalCache` / `setRelationalCache` / `wasRelationalHydrated`, `scheduleRelationalSave`, `flushPendingRelationalSaves`, `createRelationalBackedRepository`

- [ ] **Step 1: Add table name union + hydrate list**

Create `src/lib/ops-relational/types.ts`:

```typescript
export type OpsTableName =
  | 'purchases'
  | 'purchase_payments'
  | 'purchase_returns'
  | 'purchase_return_lines'
  | 'lot_qc'
  | 'sale_orders'
  | 'sale_order_payments'
  | 'sale_returns'
  | 'sale_return_lines'
  | 'production_batches'
  | 'batch_outputs'
  | 'pack_runs'
  | 'pack_run_lines'
  | 'lot_costs'
  | 'cash_entries'
  | 'payables'
  | 'receivables'
  | 'expenses'
  | 'period_locks'
  | 'period_unlock_requests'
  | 'bank_sessions'
  | 'bank_lines'
  | 'tax_settings'
  | 'tax_docs'
  | 'tax_invoices'
  | 'gl_accounts'
  | 'gl_account_map'
  | 'gl_journals'
  | 'gl_journal_lines'
  | 'gl_failed_posts'
  | 'payroll_runs'
  | 'payroll_lines'
  | 'audit_logs'

/** Module key for RLS / grouping — must match auth_can_write_module. */
export type OpsWriteModule =
  | 'pembelian'
  | 'penjualan'
  | 'produksi'
  | 'keuangan'
  | 'period'
  | 'bank'
  | 'tax'
  | 'gl'
  | 'payroll'
  | 'audit'

export type RelationalHydrateSpec = {
  table: OpsTableName
  module: OpsWriteModule
}

/** Every table that must be loaded before providers mount. */
export const ALL_RELATIONAL_HYDRATE_SPECS: RelationalHydrateSpec[] = [
  { table: 'purchases', module: 'pembelian' },
  { table: 'purchase_payments', module: 'pembelian' },
  { table: 'purchase_returns', module: 'pembelian' },
  { table: 'purchase_return_lines', module: 'pembelian' },
  { table: 'lot_qc', module: 'pembelian' },
  { table: 'sale_orders', module: 'penjualan' },
  { table: 'sale_order_payments', module: 'penjualan' },
  { table: 'sale_returns', module: 'penjualan' },
  { table: 'sale_return_lines', module: 'penjualan' },
  { table: 'production_batches', module: 'produksi' },
  { table: 'batch_outputs', module: 'produksi' },
  { table: 'pack_runs', module: 'produksi' },
  { table: 'pack_run_lines', module: 'produksi' },
  { table: 'lot_costs', module: 'produksi' },
  { table: 'cash_entries', module: 'keuangan' },
  { table: 'payables', module: 'keuangan' },
  { table: 'receivables', module: 'keuangan' },
  { table: 'expenses', module: 'keuangan' },
  { table: 'period_locks', module: 'period' },
  { table: 'period_unlock_requests', module: 'period' },
  { table: 'bank_sessions', module: 'bank' },
  { table: 'bank_lines', module: 'bank' },
  { table: 'tax_settings', module: 'tax' },
  { table: 'tax_docs', module: 'tax' },
  { table: 'tax_invoices', module: 'tax' },
  { table: 'gl_accounts', module: 'gl' },
  { table: 'gl_account_map', module: 'gl' },
  { table: 'gl_journals', module: 'gl' },
  { table: 'gl_journal_lines', module: 'gl' },
  { table: 'gl_failed_posts', module: 'gl' },
  { table: 'payroll_runs', module: 'payroll' },
  { table: 'payroll_lines', module: 'payroll' },
  { table: 'audit_logs', module: 'audit' },
]
```

- [ ] **Step 2: Implement `cloud-relational.ts` (row cache)**

Mirror `cloud-ops-docs.ts` but cache **raw table rows** (`Record<string, unknown>[]`) keyed by `OpsTableName`:

```typescript
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase-client'
import { mapSupabaseError } from '@/features/master/master-cloud'
import {
  clearCloudPersistError,
  setCloudPersistError,
} from '@/lib/cloud-persist-bus'
import type { OpsTableName } from '@/lib/ops-relational/types'

const cache = new Map<OpsTableName, Record<string, unknown>[]>()
const hydrateOk = new Map<OpsTableName, boolean>()
const saveTimers = new Map<OpsTableName, number>()
const pending = new Map<OpsTableName, Record<string, unknown>[]>()

export function isRelationalEnabled(): boolean {
  return isSupabaseConfigured()
}

export function getRelationalCache(
  table: OpsTableName,
): Record<string, unknown>[] | undefined {
  return cache.get(table)
}

export function setRelationalCache(
  table: OpsTableName,
  rows: Record<string, unknown>[],
): void {
  cache.set(table, rows)
}

export function wasRelationalHydrated(table: OpsTableName): boolean {
  return hydrateOk.get(table) === true
}

export async function loadRelationalTable(
  table: OpsTableName,
): Promise<Record<string, unknown>[]> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await sb.from(table).select('*')
  if (error) throw error
  const rows = (data ?? []) as Record<string, unknown>[]
  cache.set(table, rows)
  hydrateOk.set(table, true)
  return rows
}

/** Replace-all save: upsert rows, delete ids not in payload. */
export async function saveRelationalTable(
  table: OpsTableName,
  rows: Record<string, unknown>[],
  getId: (row: Record<string, unknown>) => string = (r) => String(r.id),
): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const stamped = rows
    .map((r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }))
    .filter((r) => Boolean(getId(r)))
  if (stamped.length) {
    const { error } = await sb.from(table).upsert(stamped)
    if (error) throw error
  }
  const { data: existing, error: listErr } = await sb.from(table).select('id')
  if (listErr) throw listErr
  const keep = new Set(stamped.map(getId))
  const drop = (existing ?? [])
    .map((r) => String((r as { id: string }).id))
    .filter((id) => !keep.has(id))
  if (drop.length) {
    const { error } = await sb.from(table).delete().in('id', drop)
    if (error) throw error
  }
  cache.set(table, stamped)
  hydrateOk.set(table, true)
}

export function scheduleRelationalSave(
  table: OpsTableName,
  rows: Record<string, unknown>[],
): void {
  if (!isRelationalEnabled()) return
  cache.set(table, rows)
  pending.set(table, rows)
  const prev = saveTimers.get(table)
  if (prev) window.clearTimeout(prev)
  const handle = window.setTimeout(() => {
    pending.delete(table)
    void saveRelationalTable(table, rows)
      .then(() => clearCloudPersistError())
      .catch((e) => setCloudPersistError(mapSupabaseError(e)))
  }, 300)
  saveTimers.set(table, handle)
}

export async function flushPendingRelationalSaves(): Promise<void> {
  if (!isRelationalEnabled()) return
  for (const t of saveTimers.values()) window.clearTimeout(t)
  saveTimers.clear()
  const entries = [...pending.entries()]
  pending.clear()
  await Promise.all(
    entries.map(async ([table, rows]) => {
      try {
        await saveRelationalTable(table, rows)
      } catch (e) {
        setCloudPersistError(mapSupabaseError(e))
      }
    }),
  )
}

export async function hydrateRelationalTables(
  specs: { table: OpsTableName }[],
): Promise<{ failed: string[] }> {
  if (!isRelationalEnabled()) return { failed: [] }
  const failed: string[] = []
  await Promise.all(
    specs.map(async ({ table }) => {
      try {
        await loadRelationalTable(table)
      } catch {
        hydrateOk.set(table, false)
        failed.push(table)
      }
    }),
  )
  if (failed.length) {
    setCloudPersistError(
      `Gagal memuat tabel: ${failed.join(', ')}. Mode lokal sementara.`,
    )
  }
  return { failed }
}
```

Special cases later: `lot_qc` / `lot_costs` / `gl_failed_posts` may use non-`id` PK — mappers must always expose `id` column in DB (copy `lot_id`/`source_key` into `id` at migrate time). Plan standardizes **every table has `id text primary key`**.

- [ ] **Step 3: Implement `createRelationalBackedRepository`**

Create `src/lib/relational-backed-repository.ts`:

```typescript
import {
  getRelationalCache,
  isRelationalEnabled,
  scheduleRelationalSave,
  setRelationalCache,
  wasRelationalHydrated,
} from '@/lib/cloud-relational'
import type { OpsTableName } from '@/lib/ops-relational/types'

type LocalRepo<TSnapshot extends object> = {
  load: () => TSnapshot
  save: (data: TSnapshot) => void
  clear: () => void
}

export type RelationalTableBind<TSnapshot extends object> = {
  table: OpsTableName
  /** True when this table must be hydrated before assemble. */
  required: boolean
  /** Project snapshot → rows for this table (may be empty array). */
  readRows: (snap: TSnapshot) => Record<string, unknown>[]
  /**
   * Fold cached rows into snapshot. Called only after all required
   * tables for this bind group are hydrated — implementer usually
   * passes one `assemble` bind that reads multiple caches.
   */
  writeRows?: (snap: TSnapshot, rows: Record<string, unknown>[]) => TSnapshot
}

/**
 * Prefer a single assemble function that reads all related caches.
 */
export function createRelationalBackedRepository<TSnapshot extends object>(options: {
  local: LocalRepo<TSnapshot>
  normalize?: (data: TSnapshot) => TSnapshot
  /** Tables written on save (headers + children). */
  tables: OpsTableName[]
  /** Build snapshot slice from relational caches; null = not ready. */
  assemble: (base: TSnapshot) => TSnapshot | null
  /** Split snapshot into per-table rows. */
  project: (snap: TSnapshot) => Partial<Record<OpsTableName, Record<string, unknown>[]>>
}): LocalRepo<TSnapshot> {
  const { local, normalize, tables, assemble, project } = options
  const norm = (data: TSnapshot) => (normalize ? normalize(data) : data)

  return {
    load() {
      if (isRelationalEnabled()) {
        for (const t of tables) {
          if (!wasRelationalHydrated(t)) return norm(local.load())
        }
        const assembled = assemble(local.load())
        if (assembled) return norm(assembled)
        return norm(local.load())
      }
      return norm(local.load())
    },
    save(data: TSnapshot) {
      const next = norm(data)
      if (isRelationalEnabled()) {
        const parts = project(next)
        let anyUnhydrated = false
        for (const t of tables) {
          const rows = parts[t] ?? []
          setRelationalCache(t, rows)
          if (wasRelationalHydrated(t)) {
            scheduleRelationalSave(t, rows)
          } else {
            anyUnhydrated = true
          }
        }
        if (anyUnhydrated) local.save(next)
        return
      }
      local.save(next)
    },
    clear() {
      local.clear()
    },
  }
}
```

- [ ] **Step 4: Typecheck stub**

Run: `npx tsc -p tsconfig.app.json --noEmit`  
Expected: exit 0 (new files unused is fine).

- [ ] **Step 5: Commit (optional)**

```bash
git add src/lib/ops-relational/types.ts src/lib/cloud-relational.ts src/lib/relational-backed-repository.ts
git commit -m "feat(cloud): add relational table persist bus"
```

---

### Task 2: Migration — CREATE tables + RLS

**Files:**
- Create: `supabase/migrations/20261030_ops_relational.sql` (CREATE + RLS section only first; COPY in Task 3)

**Interfaces:**
- Produces: all tables listed in `OpsTableName` with `id text PK`, `created_at`/`updated_at timestamptz`, module-scoped RLS

- [ ] **Step 1: Write CREATE for pembelian + penjualan + produksi**

Start `supabase/migrations/20261030_ops_relational.sql` with:

```sql
-- Ops relational tables. Depends on auth_can_write_module().
-- Pattern: typed scalars + jsonb for small objects; child tables for arrays.

-- ========== PEMBELIAN ==========
create table if not exists public.purchases (
  id text primary key,
  date text not null default '',
  supplier_id text not null default '',
  grain text not null default '',
  sacks numeric not null default 0,
  estimated_kg numeric not null default 0,
  price numeric not null default 0,
  effective_price numeric,
  lot_id text,
  vehicle text,
  note text,
  stage text not null default '',
  weighing jsonb,
  due_date text,
  invoice_proof jsonb,
  purchase_proof jsonb,
  approvals jsonb,
  reject_reason text,
  budget_approved_at text,
  completed_at text,
  voided_at text,
  void_reason text,
  tax jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchases_supplier_id_idx on public.purchases (supplier_id);
create index if not exists purchases_lot_id_idx on public.purchases (lot_id);

create table if not exists public.purchase_payments (
  id text primary key,
  purchase_id text not null,
  amount numeric not null default 0,
  date text not null default '',
  method text,
  note text,
  proof jsonb,
  actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchase_payments_purchase_id_idx
  on public.purchase_payments (purchase_id);

create table if not exists public.purchase_returns (
  id text primary key,
  purchase_id text not null default '',
  lot_id text,
  reason text not null default '',
  stage text not null default '',
  approvals jsonb,
  tax jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_return_lines (
  id text primary key,
  return_id text not null,
  sku text not null default '',
  product_name text not null default '',
  unit text not null default 'kg',
  qty numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchase_return_lines_return_id_idx
  on public.purchase_return_lines (return_id);

create table if not exists public.lot_qc (
  id text primary key, -- = lot_id
  lot_id text not null,
  purchase_id text not null default '',
  moisture numeric,
  impurity numeric,
  grade text,
  passed boolean,
  by_actor text,
  at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== PENJUALAN ==========
create table if not exists public.sale_orders (
  id text primary key,
  date text not null default '',
  customer_id text not null default '',
  sku text not null default '',
  product_name text not null default '',
  qty numeric not null default 0,
  price numeric not null default 0,
  stage text not null default '',
  delivery jsonb,
  due_date text,
  lot_id text,
  approvals jsonb,
  tax jsonb,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_order_payments (
  id text primary key,
  order_id text not null,
  amount numeric not null default 0,
  date text not null default '',
  method text,
  note text,
  proof jsonb,
  actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sale_order_payments_order_id_idx
  on public.sale_order_payments (order_id);

create table if not exists public.sale_returns (
  id text primary key,
  order_id text not null default '',
  reason text not null default '',
  stage text not null default '',
  approvals jsonb,
  tax jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_return_lines (
  id text primary key,
  return_id text not null,
  sku text not null default '',
  product_name text not null default '',
  unit text not null default 'kg',
  qty numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== PRODUKSI ==========
create table if not exists public.production_batches (
  id text primary key,
  date text not null default '',
  operator text,
  stage text not null default '',
  input_sku text,
  input_qty numeric,
  input_location text,
  input_lot_id text,
  rendemen numeric,
  stock_flags jsonb,
  wip_value numeric,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.batch_outputs (
  id text primary key,
  batch_id text not null,
  sku text not null default '',
  product_name text,
  qty numeric not null default 0,
  unit text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists batch_outputs_batch_id_idx on public.batch_outputs (batch_id);

create table if not exists public.pack_runs (
  id text primary key,
  batch_id text,
  source_sku text,
  stage text not null default '',
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pack_run_lines (
  id text primary key,
  pack_run_id text not null,
  sku text not null default '',
  qty numeric not null default 0,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lot_costs (
  id text primary key, -- = lot_id
  lot_id text not null,
  batch_id text,
  grain_value numeric,
  allocated_ops numeric,
  beras_qty numeric,
  cost_per_kg_beras numeric,
  method text,
  at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Align column names with actual TS field names when implementing: open `pembelian-data.ts`, `penjualan-data.ts`, `produksi-data.ts` and add any missing scalars as columns (or fold into `extra jsonb`). Do **not** invent business fields.

- [ ] **Step 2: Append CREATE for keuangan → audit**

Add flat tables:

```sql
-- keuangan: cash_entries, payables, receivables, expenses
-- period: period_locks (unlock_history jsonb), period_unlock_requests (approvals jsonb)
-- bank: bank_sessions, bank_lines
-- tax: tax_settings, tax_docs, tax_invoices
-- gl: gl_accounts, gl_account_map (value jsonb), gl_journals, gl_journal_lines, gl_failed_posts
-- payroll: payroll_runs, payroll_lines
-- audit: audit_logs (before_doc jsonb, after_doc jsonb)
```

Each table: `id text primary key`, timestamps, typed scalars from the corresponding `*-data.ts` / storage types. For `gl_journal_lines` include `journal_id`, `account_id`, `debit`, `credit`, `memo`. For `payroll_lines` include `run_id`, `user_id`, pay component columns or `components jsonb`.

- [ ] **Step 3: Append RLS helper + policies**

```sql
create or replace function public.enable_ops_table_rls(p_table text, p_module text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_select', p_table);
  execute format(
    'create policy %I on public.%I for select to authenticated using (true)',
    p_table || '_select', p_table
  );
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (public.auth_can_write_module(%L))',
    p_table || '_insert', p_table, p_module
  );
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format(
    'create policy %I on public.%I for update to authenticated using (public.auth_can_write_module(%L)) with check (public.auth_can_write_module(%L))',
    p_table || '_update', p_table, p_module, p_module
  );
  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);
  execute format(
    'create policy %I on public.%I for delete to authenticated using (public.auth_can_write_module(%L))',
    p_table || '_delete', p_table, p_module
  );
end;
$$;

select public.enable_ops_table_rls('purchases', 'pembelian');
select public.enable_ops_table_rls('purchase_payments', 'pembelian');
-- …call for every table in ALL_RELATIONAL_HYDRATE_SPECS with matching module…
```

- [ ] **Step 4: Dry-run syntax locally**

Parse PG env from `.env.local` `DATABASE_URL` (same split as prior sessions), then:

```powershell
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261030_ops_relational.sql
```

Expected: creates succeed (or re-run idempotent). If COPY not yet in file, stop before DROP.

- [ ] **Step 5: Commit (optional)**

```bash
git add supabase/migrations/20261030_ops_relational.sql
git commit -m "feat(db): add relational ops tables and RLS"
```

---

### Task 3: Migration — COPY from `ops_docs` + verify + DROP

**Files:**
- Modify: `supabase/migrations/20261030_ops_relational.sql` (append DO block + DROP)

**Interfaces:**
- Consumes: existing `ops_docs(module, collection, id, doc)`
- Produces: populated relational tables; `ops_docs` dropped

- [ ] **Step 1: Append COPY block for pembelian (template for all)**

```sql
do $$
declare
  r record;
  elem jsonb;
  pay jsonb;
  line jsonb;
  doc_id text;
  pay_id text;
  line_id text;
  line_n int;
begin
  for r in select id, doc from public.ops_docs where module='pembelian' and collection='purchases'
  loop
    insert into public.purchases (
      id, date, supplier_id, grain, sacks, estimated_kg, price, effective_price,
      lot_id, vehicle, note, stage, weighing, due_date, invoice_proof, purchase_proof,
      approvals, reject_reason, budget_approved_at, completed_at, voided_at, void_reason, tax
    ) values (
      r.id,
      coalesce(r.doc->>'date',''),
      coalesce(r.doc->>'supplierId',''),
      coalesce(r.doc->>'grain',''),
      coalesce((r.doc->>'sacks')::numeric,0),
      coalesce((r.doc->>'estimatedKg')::numeric,0),
      coalesce((r.doc->>'price')::numeric,0),
      nullif(r.doc->>'effectivePrice','')::numeric,
      r.doc->>'lotId',
      r.doc->>'vehicle',
      r.doc->>'note',
      coalesce(r.doc->>'stage',''),
      r.doc->'weighing',
      r.doc->>'dueDate',
      r.doc->'invoiceProof',
      r.doc->'purchaseProof',
      r.doc->'approvals',
      r.doc->>'rejectReason',
      r.doc->>'budgetApprovedAt',
      r.doc->>'completedAt',
      r.doc->>'voidedAt',
      r.doc->>'voidReason',
      jsonb_strip_nulls(jsonb_build_object(
        -- copy TaxSnapshotFields keys present on doc; adjust to real field names
        'ppnRate', r.doc->'ppnRate',
        'dpp', r.doc->'dpp',
        'ppn', r.doc->'ppn'
      ))
    ) on conflict (id) do update set
      doc_placeholder = excluded.id; -- REPLACE: set real columns = excluded.*

    for pay in select * from jsonb_array_elements(coalesce(r.doc->'payments','[]'::jsonb))
    loop
      pay_id := coalesce(pay->>'id', r.id || '-pay-' || floor(random()*1e9)::text);
      insert into public.purchase_payments (id, purchase_id, amount, date, method, note, proof, actor)
      values (
        pay_id, r.id,
        coalesce((pay->>'amount')::numeric,0),
        coalesce(pay->>'date',''),
        pay->>'method',
        pay->>'note',
        pay->'proof',
        pay->>'actor'
      ) on conflict (id) do update set amount = excluded.amount, updated_at = now();
    end loop;
  end loop;

  -- returns + lines + lot_qc similarly…
end $$;
```

**Implementer note:** Fix the `on conflict do update` to list real columns (no `doc_placeholder`). Repeat patterns for every collection in the design inventory. Child line ids without id: use `parent_id || '-' || ordinal`.

- [ ] **Step 2: Verify counts before DROP**

```sql
-- Example checks (extend for all modules)
select 'ops purchases' as src, count(*) from ops_docs where module='pembelian' and collection='purchases'
union all select 'rel purchases', count(*) from purchases;
```

Expected: counts match (payments count = sum of payments array lengths).

- [ ] **Step 3: DROP legacy**

```sql
drop table if exists public.ops_docs cascade;
drop table if exists public.app_module_snapshots cascade;
```

Only after counts OK. Optionally `pg_dump` ops_docs first via supabase backup.

- [ ] **Step 4: Apply full migration to Supabase**

Parse `DATABASE_URL`, run `psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261030_ops_relational.sql`.  
Expected: exit 0; `\dt` shows new tables; no `ops_docs`.

- [ ] **Step 5: Commit (optional)**

```bash
git add supabase/migrations/20261030_ops_relational.sql
git commit -m "feat(db): migrate ops_docs into relational tables"
```

---

### Task 4: Mappers + wire pembelian

**Files:**
- Create: `src/lib/ops-relational/mappers/pembelian.ts`
- Modify: `src/features/pembelian/pembelian-storage.ts`

**Interfaces:**
- Consumes: `createRelationalBackedRepository`, caches for pembelian tables
- Produces: `assemblePembelian` / `projectPembelian` used by storage

- [ ] **Step 1: Read `Purchase` / `Payment` / `PurchaseReturn` types**

Open `src/features/pembelian/pembelian-data.ts` and map every field used at runtime to columns from Task 2. Adjust SQL/mapper if a field was missed.

- [ ] **Step 2: Write mapper**

```typescript
// src/lib/ops-relational/mappers/pembelian.ts
import type { LotQc, Purchase, PurchaseReturn } from '@/features/pembelian/pembelian-data'
import type { PembelianSnapshot } from '@/features/pembelian/pembelian-storage'
import { getRelationalCache } from '@/lib/cloud-relational'

function paymentFromRow(r: Record<string, unknown>): Purchase['payments'][number] {
  return {
    id: String(r.id),
    amount: Number(r.amount ?? 0),
    date: String(r.date ?? ''),
    method: r.method as Purchase['payments'][number]['method'],
    note: (r.note as string) || undefined,
    // map proof/actor to match Payment type exactly
  } as Purchase['payments'][number]
}

export function assemblePembelian(base: PembelianSnapshot): PembelianSnapshot | null {
  const purchases = getRelationalCache('purchases')
  const payments = getRelationalCache('purchase_payments')
  const returns = getRelationalCache('purchase_returns')
  const returnLines = getRelationalCache('purchase_return_lines')
  const lotQc = getRelationalCache('lot_qc')
  if (!purchases || !payments || !returns || !returnLines || !lotQc) return null

  const paysByPurchase = new Map<string, Purchase['payments']>()
  for (const p of payments) {
    const pid = String(p.purchase_id)
    const list = paysByPurchase.get(pid) ?? []
    list.push(paymentFromRow(p))
    paysByPurchase.set(pid, list)
  }

  const purchaseDocs: Purchase[] = purchases.map((row) => {
    // map snake_case columns → Purchase; attach payments
    return {
      id: String(row.id),
      date: String(row.date ?? ''),
      supplierId: String(row.supplier_id ?? ''),
      // …all required Purchase fields…
      payments: paysByPurchase.get(String(row.id)) ?? [],
    } as Purchase
  })

  // similarly assemble returns + lines, lotQc
  return {
    ...base,
    purchases: purchaseDocs,
    returns: [] as PurchaseReturn[], // fill
    lotQc: [] as LotQc[], // fill
    updatedAt: new Date().toISOString(),
  }
}

export function projectPembelian(
  snap: PembelianSnapshot,
): Partial<Record<string, Record<string, unknown>[]>> {
  const purchaseRows: Record<string, unknown>[] = []
  const paymentRows: Record<string, unknown>[] = []
  for (const p of snap.purchases) {
    const { payments, ...rest } = p
    purchaseRows.push({
      id: rest.id,
      date: rest.date,
      supplier_id: rest.supplierId,
      // …snake_case…
    })
    for (const pay of payments ?? []) {
      paymentRows.push({
        id: pay.id,
        purchase_id: p.id,
        amount: pay.amount,
        date: pay.date,
      })
    }
  }
  return {
    purchases: purchaseRows,
    purchase_payments: paymentRows,
    purchase_returns: [],
    purchase_return_lines: [],
    lot_qc: [],
  }
}
```

Fill every field completely (no `as Purchase` shortcuts that drop data). Use exhaustive mapping.

- [ ] **Step 3: Wire `pembelian-storage.ts`**

Replace `createOpsDocsBackedRepository` with:

```typescript
import { createRelationalBackedRepository } from '@/lib/relational-backed-repository'
import {
  assemblePembelian,
  projectPembelian,
} from '@/lib/ops-relational/mappers/pembelian'

export const pembelianRepository = createRelationalBackedRepository({
  local: inner,
  normalize,
  tables: [
    'purchases',
    'purchase_payments',
    'purchase_returns',
    'purchase_return_lines',
    'lot_qc',
  ],
  assemble: assemblePembelian,
  project: projectPembelian,
})
```

- [ ] **Step 4: `tsc`**

Run: `npx tsc -p tsconfig.app.json --noEmit`  
Expected: exit 0.

---

### Task 5: Wire penjualan + produksi

**Files:**
- Create: `src/lib/ops-relational/mappers/penjualan.ts`
- Create: `src/lib/ops-relational/mappers/produksi.ts`
- Modify: `src/features/penjualan/penjualan-storage.ts`
- Modify: `src/features/produksi/produksi-storage.ts`

**Interfaces:** Same pattern as Task 4 (`assemble*` / `project*`).

- [ ] **Step 1: Implement penjualan mapper + storage switch** (orders, payments, returns, return_lines)
- [ ] **Step 2: Implement produksi mapper + storage switch** (batches, batch_outputs, pack_runs, pack_run_lines, lot_costs)
- [ ] **Step 3: `tsc` — expect exit 0

---

### Task 6: Wire keuangan family (keuangan, period, bank, tax, gl)

**Files:**
- Create: `src/lib/ops-relational/mappers/keuangan.ts`, `period.ts`, `bank.ts`, `tax.ts`, `gl.ts`
- Modify:  
  `src/features/keuangan/keuangan-storage.ts`  
  `src/features/keuangan/period-storage.ts`  
  `src/features/keuangan/bank-storage.ts`  
  `src/features/keuangan/tax-storage.ts`  
  `src/features/keuangan/gl-storage.ts`

- [ ] **Step 1: Flat modules (keuangan, period, bank, tax)** — header-only mappers; period unlock_history/approvals stay jsonb columns
- [ ] **Step 2: GL mapper** — join `gl_journals` + `gl_journal_lines`; singleton `gl_account_map` ↔ `{ id:'map', value }`
- [ ] **Step 3: `tsc` — expect exit 0

---

### Task 7: Wire payroll + audit

**Files:**
- Create: `src/lib/ops-relational/mappers/payroll.ts`, `audit.ts`
- Modify: `src/features/payroll/payroll-storage.ts`, `src/features/audit/audit-storage.ts`

- [ ] **Step 1: payroll_runs + payroll_lines assemble/project**
- [ ] **Step 2: audit_logs map before/after jsonb**
- [ ] **Step 3: `tsc` — expect exit 0

---

### Task 8: Gate + Auth flush cutover

**Files:**
- Modify: `src/features/cloud/OpsCloudGate.tsx`
- Modify: `src/features/auth/AuthContext.tsx`

- [ ] **Step 1: OpsCloudGate uses relational hydrate**

```typescript
import {
  ALL_RELATIONAL_HYDRATE_SPECS,
  // re-export hydrate + flush from cloud-relational via types file or cloud-relational
} from '@/lib/ops-relational/types'
import {
  flushPendingRelationalSaves,
  hydrateRelationalTables,
  isRelationalEnabled,
} from '@/lib/cloud-relational'
```

Replace ops_docs calls with relational equivalents; keep persist error banner.

- [ ] **Step 2: AuthContext flush**

```typescript
import { flushPendingRelationalSaves } from '@/lib/cloud-relational'
// void flushPendingRelationalSaves().finally(...)
```

- [ ] **Step 3: Grep for leftover ops_docs usage in features**

Run: `rg "cloud-ops-docs|ops-docs-backed|createOpsDocsBackedRepository" src`  
Expected: only dead files (removed in Task 9) or zero hits in features.

- [ ] **Step 4: `tsc` — expect exit 0

---

### Task 9: Delete dead code + final verify

**Files:**
- Delete (if unused): `src/lib/cloud-ops-docs.ts`, `src/lib/ops-docs-backed-repository.ts`
- Optionally leave `cloud-snapshot.ts` / `cloud-backed-repository.ts` if still unused — delete only if nothing imports them
- Update: `docs/superpowers/specs/2026-10-30-ops-docs-normalize-design.md` status note → superseded by relational spek (one paragraph)

- [ ] **Step 1: Remove dead imports/files**
- [ ] **Step 2: SQL final inventory**

```sql
select relname from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by 1;
```

Expected: no `ops_docs`; relational tables present; master/stock/profiles intact.

- [ ] **Step 3: `npx tsc -p tsconfig.app.json --noEmit` + `npm run build`**  
Expected: both exit 0.

- [ ] **Step 4: Smoke checklist (manual)**  
Login admin → open pembelian/penjualan/produksi/keuangan → edit one doc each → reload → data persists from Supabase tables.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Typed domain tables + child arrays | 2, 3 |
| jsonb for small blobs / audit | 2 |
| Soft FK text | 2 |
| RLS via `auth_can_write_module` | 2 |
| App storage rewire, UI unchanged | 4–8 |
| Migrate from ops_docs then drop | 3 |
| Drop snapshots if empty | 3 |
| Verify tsc + counts + smoke | 3, 9 |
| All 10 modules big-bang | 4–7 + 3 |

**Placeholder scan:** Mapper snippets use `// …` where field lists must be completed from TS types at implement time — treat as mandatory expand, not skip. SQL `doc_placeholder` must be replaced before apply.

**Type consistency:** `OpsTableName` / `ALL_RELATIONAL_HYDRATE_SPECS` are the single source of table list for hydrate, RLS enable calls, and storage `tables` arrays.

---
