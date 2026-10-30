# Supabase Master + RBAC (DB-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect E-Gabah to Supabase with real Auth + `profiles` RBAC and cloud-backed Master (partners/products), falling back to demo auth + localStorage when env is missing.

**Architecture:** Thin `@supabase/supabase-js` client; AuthContext branches on `isSupabaseConfigured()`; MasterProvider loads/saves via async cloud adapters that map to `MasterSnapshot` while keeping page UI unchanged. RLS enforces admin-only writes; React `RequireRole` still gates Master routes.

**Tech Stack:** React 19, Vite 7, TypeScript, `@supabase/supabase-js`, Postgres RLS on Supabase project `ulhcvbnsfikycffvycxa`.

**Spec:** `docs/superpowers/specs/2026-10-30-supabase-master-rbac-design.md`

## Global Constraints

- Client uses only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — never Postgres password or service_role in Vite.
- Env empty → silent local mode (`demo-users` + `egabah.master.v1`).
- Master UI/pages stay; change AuthContext + repository/store adapters only.
- Full upsert partners/products on each Master persist MVP; no realtime.
- New Auth users: create in Supabase Dashboard (or seed); Master UI only **updates** existing `profiles` in cloud mode.
- Cloudinary env already prepared — **no upload code** this plan.
- No Vitest; verify with `npx tsc -p tsconfig.app.json --noEmit` + manual checks in spek.
- Never commit `.env.local`.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/supabase-client.ts` | `createClient` / `null`, `isSupabaseConfigured()` |
| `supabase/migrations/20261030_master_rbac.sql` | Enums, tables, RLS, indexes (paste into SQL Editor) |
| `docs/supabase-seed-master.md` | Manual seed: Auth users + profiles + partners/products |
| `src/features/master/master-db-map.ts` | Row ↔ `MasterPartner` / `MasterProduct` / `MasterUser` |
| `src/features/master/master-cloud.ts` | `loadMasterCloud`, `saveMasterCloud`, profile CRUD helpers |
| `src/features/master/master-storage.ts` | Keep local; export seed helpers if needed |
| `src/features/master/master-store.tsx` | Async hydrate + cloud persist + error banner |
| `src/features/auth/AuthContext.tsx` | Supabase login + profile role; local fallback |
| `src/lib/auth-storage.ts` | Unchanged session cache for AuthUser |
| `docs/BACKEND.md` | Point to migration + env |
| `.env.example` | Already present |

---

### Task 0: Branch + mark spek status

**Files:**
- Modify: `docs/superpowers/specs/2026-10-30-supabase-master-rbac-design.md`

- [ ] **Step 1: Foundation**

```bash
git branch --show-current
git log -3 --oneline
npx tsc -p tsconfig.app.json --noEmit
```

Expected: `main` (or clean), tsc exit 0.

- [ ] **Step 2: Feature branch**

```bash
git checkout -b feat/supabase-master-rbac
```

- [ ] **Step 3: Mark spek**

Set status to: `Status: approved (user: acc → plan)`.

```bash
git add docs/superpowers/specs/2026-10-30-supabase-master-rbac-design.md
git commit -m "docs: mark supabase master RBAC spek approved for plan"
```

---

### Task 1: Install client + `supabase-client.ts`

**Files:**
- Modify: `package.json` / lockfile via npm
- Create: `src/lib/supabase-client.ts`
- Verify: `src/vite-env.d.ts` (already has env types)

**Interfaces:**
- Produces: `isSupabaseConfigured(): boolean`, `getSupabase(): SupabaseClient | null`

- [ ] **Step 1: Install dependency**

```bash
npm install @supabase/supabase-js
```

Expected: package listed in `dependencies`.

- [ ] **Step 2: Create client module**

```ts
// src/lib/supabase-client.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  return Boolean(url && key)
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    client = null
    return client
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/supabase-client.ts
git commit -m "feat(db): add supabase-js client gated by Vite env"
```

---

### Task 2: SQL migration (schema + RLS)

**Files:**
- Create: `supabase/migrations/20261030_master_rbac.sql`

**Interfaces:**
- Produces: tables `profiles`, `partners`, `products`; function `auth_is_admin()`

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/20261030_master_rbac.sql
-- Paste into Supabase SQL Editor (or supabase db push). Run once.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum (
    'admin', 'pembelian', 'produksi', 'gudang', 'penjualan', 'keuangan'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_kind as enum ('supplier', 'customer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_category as enum ('gabah', 'beras', 'sampingan');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method_pref as enum ('tunai', 'transfer', 'campuran');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '',
  role public.user_role not null default 'pembelian',
  title text not null default '',
  phone text not null default '',
  branch text not null default '',
  department text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partners (
  id text primary key,
  kind public.partner_kind not null,
  name text not null,
  legal_name text not null default '',
  "group" text not null default '',
  area text not null default '',
  postal_code text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  npwp text not null default '',
  pkp boolean not null default false,
  bank_name text not null default '',
  bank_account text not null default '',
  bank_holder text not null default '',
  payment_method public.payment_method_pref not null default 'transfer',
  payment_term_days integer not null default 0,
  credit_limit numeric not null default 0,
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  sku text not null unique,
  name text not null,
  unit text not null default 'kg',
  category public.product_category not null default 'gabah',
  barcode text not null default '',
  default_price numeric not null default 0,
  cost_price numeric not null default 0,
  min_qty numeric not null default 0,
  taxable boolean not null default true,
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_kind_idx on public.partners (kind);
create index if not exists products_sku_idx on public.products (sku);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

create or replace function public.auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.active = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.partners enable row level security;
alter table public.products enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.auth_is_admin());

drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

-- partners
drop policy if exists partners_select on public.partners;
create policy partners_select on public.partners
  for select to authenticated
  using (true);

drop policy if exists partners_write on public.partners;
create policy partners_write on public.partners
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

-- products
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (true);

drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

- [ ] **Step 2: Apply in Supabase**

Dashboard → SQL Editor → New query → paste file → Run.  
Expected: success, no error; Table Editor shows `profiles`, `partners`, `products`.

- [ ] **Step 3: Commit SQL only**

```bash
git add supabase/migrations/20261030_master_rbac.sql
git commit -m "chore(db): SQL schema + RLS for profiles partners products"
```

---

### Task 3: Seed documentation + SQL seed for master rows

**Files:**
- Create: `docs/supabase-seed-master.md`
- Create: `supabase/seed/20261030_master_data.sql` (partners + products only; profiles need Auth UUIDs)

**Interfaces:**
- Documents 6 Auth users matching `DEMO_ACCOUNTS` emails / `demo123`

- [ ] **Step 1: Write seed guide**

Create `docs/supabase-seed-master.md` with:

1. **Auth users** — Dashboard → Authentication → Users → Add user (disable email confirm). Table:

| Email | Password | profile.role |
| --- | --- | --- |
| admin@egabah.local | demo123 | admin |
| beli@egabah.local | demo123 | pembelian |
| produksi@egabah.local | demo123 | produksi |
| gudang@egabah.local | demo123 | gudang |
| jual@egabah.local | demo123 | penjualan |
| kas@egabah.local | demo123 | keuangan |

Copy each UUID after create.

2. **Profiles SQL** — replace UUID placeholders:

```sql
insert into public.profiles (id, email, name, role, title, phone, branch, department, active)
values
  ('UUID_ADMIN', 'admin@egabah.local', 'Admin E-Gabah', 'admin', 'Pemilik', '0812-0000-0001', 'Kantor Pusat', 'Manajemen', true),
  ('UUID_BELI', 'beli@egabah.local', 'Petugas Pembelian', 'pembelian', '', '0812-0000-0002', '', 'Pembelian', true),
  ('UUID_PRODUKSI', 'produksi@egabah.local', 'Operator Produksi', 'produksi', '', '0812-0000-0003', '', 'Produksi', true),
  ('UUID_GUDANG', 'gudang@egabah.local', 'Petugas Gudang', 'gudang', '', '0812-0000-0004', '', 'Gudang', true),
  ('UUID_JUAL', 'jual@egabah.local', 'Petugas Penjualan', 'penjualan', '', '0812-0000-0005', '', 'Penjualan', true),
  ('UUID_KAS', 'kas@egabah.local', 'Petugas Keuangan', 'keuangan', '', '0812-0000-0006', '', 'Keuangan', true)
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();
```

3. **Partners + products** — run `supabase/seed/20261030_master_data.sql`.

4. **Verify:**

```sql
select email, role, active from public.profiles order by email;
select count(*) from public.partners;
select count(*) from public.products;
```

- [ ] **Step 2: Generate partners/products seed SQL**

Create `supabase/seed/20261030_master_data.sql` by exporting current `SEED_SUPPLIERS`, `SEED_CUSTOMERS`, `SEED_PRODUCTS` into `insert ... on conflict do update` rows (snake_case columns matching Task 2). Include every seed row from `master-data.ts` — do not leave empty stub.

Minimal shape per partner:

```sql
insert into public.partners (
  id, kind, name, legal_name, "group", area, postal_code, phone, email, address,
  contact_name, contact_phone, npwp, pkp, bank_name, bank_account, bank_holder,
  payment_method, payment_term_days, credit_limit, active, note
) values
  ('SUP-…', 'supplier', '…', …)
on conflict (id) do update set
  name = excluded.name,
  updated_at = now();
```

Same for `products` with `sku`, `category`, prices, etc.

Implementer: read `SEED_*` arrays and emit complete inserts (script one-off in Node or hand-transcribe — completeness required).

- [ ] **Step 3: Run seed in project** (human / agent with Dashboard access)

Follow `docs/supabase-seed-master.md`. Expected: 6 profiles, N partners, M products.

- [ ] **Step 4: Commit docs + seed SQL**

```bash
git add docs/supabase-seed-master.md supabase/seed/20261030_master_data.sql
git commit -m "docs(db): seed guide and master partners/products SQL"
```

---

### Task 4: Row mappers

**Files:**
- Create: `src/features/master/master-db-map.ts`

**Interfaces:**
- Produces: `PartnerRow`, `ProductRow`, `ProfileRow`, `partnerFromRow`, `partnerToRow`, `productFromRow`, `productToRow`, `userFromProfile`

- [ ] **Step 1: Implement mappers**

```ts
// src/features/master/master-db-map.ts
import type {
  MasterPartner,
  MasterProduct,
  MasterUser,
  PartnerKind,
  PaymentMethodPref,
  ProductCategory,
} from '@/features/master/master-data'
import { ROLE_LABELS, type UserRole } from '@/types/auth'

export type PartnerRow = {
  id: string
  kind: PartnerKind
  name: string
  legal_name: string
  group: string
  area: string
  postal_code: string
  phone: string
  email: string
  address: string
  contact_name: string
  contact_phone: string
  npwp: string
  pkp: boolean
  bank_name: string
  bank_account: string
  bank_holder: string
  payment_method: PaymentMethodPref
  payment_term_days: number
  credit_limit: number
  active: boolean
  note: string
}

export type ProductRow = {
  id: string
  sku: string
  name: string
  unit: string
  category: ProductCategory
  barcode: string
  default_price: number
  cost_price: number
  min_qty: number
  taxable: boolean
  active: boolean
  note: string
}

export type ProfileRow = {
  id: string
  email: string
  name: string
  role: UserRole
  title: string
  phone: string
  branch: string
  department: string
  active: boolean
}

export function partnerFromRow(r: PartnerRow): MasterPartner {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    legalName: r.legal_name,
    group: r.group,
    area: r.area,
    postalCode: r.postal_code,
    phone: r.phone,
    email: r.email,
    address: r.address,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    npwp: r.npwp,
    pkp: r.pkp,
    bankName: r.bank_name,
    bankAccount: r.bank_account,
    bankHolder: r.bank_holder,
    paymentMethod: r.payment_method,
    paymentTermDays: Number(r.payment_term_days) || 0,
    creditLimit: Number(r.credit_limit) || 0,
    active: r.active,
    note: r.note,
  }
}

export function partnerToRow(p: MasterPartner): PartnerRow {
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    legal_name: p.legalName,
    group: p.group,
    area: p.area,
    postal_code: p.postalCode,
    phone: p.phone,
    email: p.email,
    address: p.address,
    contact_name: p.contactName,
    contact_phone: p.contactPhone,
    npwp: p.npwp,
    pkp: p.pkp,
    bank_name: p.bankName,
    bank_account: p.bankAccount,
    bank_holder: p.bankHolder,
    payment_method: p.paymentMethod,
    payment_term_days: p.paymentTermDays,
    credit_limit: p.creditLimit,
    active: p.active,
    note: p.note,
  }
}

export function productFromRow(r: ProductRow): MasterProduct {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    unit: r.unit,
    category: r.category,
    barcode: r.barcode,
    defaultPrice: Number(r.default_price) || 0,
    costPrice: Number(r.cost_price) || 0,
    minQty: Number(r.min_qty) || 0,
    taxable: r.taxable,
    active: r.active,
    note: r.note,
  }
}

export function productToRow(p: MasterProduct): ProductRow {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    category: p.category,
    barcode: p.barcode,
    default_price: p.defaultPrice,
    cost_price: p.costPrice,
    min_qty: p.minQty,
    taxable: p.taxable,
    active: p.active,
    note: p.note,
  }
}

export function userFromProfile(r: ProfileRow): MasterUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    title: r.title,
    phone: r.phone,
    branch: r.branch,
    department: r.department,
    active: r.active,
  }
}

export function authUserFromProfile(r: ProfileRow) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    roleLabel: ROLE_LABELS[r.role],
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/master/master-db-map.ts
git commit -m "feat(master): map Supabase rows to Master domain types"
```

---

### Task 5: `master-cloud.ts` load/save

**Files:**
- Create: `src/features/master/master-cloud.ts`

**Interfaces:**
- Consumes: `getSupabase`, mappers, `MasterSnapshot`
- Produces: `loadMasterCloud(): Promise<MasterSnapshot>`, `saveMasterCloud(snap: MasterSnapshot): Promise<void>`, `loadProfileByUserId(id: string)`, `updateProfileUser(user: MasterUser): Promise<void>`, `mapSupabaseError(err: unknown): string`

- [ ] **Step 1: Implement cloud adapter**

```ts
// src/features/master/master-cloud.ts
import { getSupabase } from '@/lib/supabase-client'
import type { MasterSnapshot } from '@/features/master/master-storage'
import type { MasterUser } from '@/features/master/master-data'
import {
  authUserFromProfile,
  partnerFromRow,
  partnerToRow,
  productFromRow,
  productToRow,
  userFromProfile,
  type PartnerRow,
  type ProductRow,
  type ProfileRow,
} from '@/features/master/master-db-map'

export function mapSupabaseError(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (code === '42501' || /permission|row-level security/i.test(msg)) {
    return 'Tidak punya izin (RLS).'
  }
  return msg || 'Gagal menyimpan ke cloud.'
}

export async function loadProfileByUserId(userId: string): Promise<ProfileRow> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await sb
    .from('profiles')
    .select(
      'id, email, name, role, title, phone, branch, department, active',
    )
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Profil pengguna tidak ditemukan.')
  return data as ProfileRow
}

export { authUserFromProfile }

export async function loadMasterCloud(): Promise<MasterSnapshot> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')

  const [partnersRes, productsRes, profilesRes] = await Promise.all([
    sb.from('partners').select('*'),
    sb.from('products').select('*'),
    sb.from('profiles').select(
      'id, email, name, role, title, phone, branch, department, active',
    ),
  ])

  if (partnersRes.error) throw partnersRes.error
  if (productsRes.error) throw productsRes.error
  if (profilesRes.error) throw profilesRes.error

  const partners = (partnersRes.data as PartnerRow[]).map(partnerFromRow)
  const products = (productsRes.data as ProductRow[]).map(productFromRow)
  const users = (profilesRes.data as ProfileRow[]).map(userFromProfile)

  return {
    version: 1,
    suppliers: partners.filter((p) => p.kind === 'supplier'),
    customers: partners.filter((p) => p.kind === 'customer'),
    products,
    users,
    updatedAt: new Date().toISOString(),
  }
}

export async function saveMasterCloud(snap: MasterSnapshot): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')

  const partnerRows = [...snap.suppliers, ...snap.customers].map(partnerToRow)
  const productRows = snap.products.map(productToRow)

  if (partnerRows.length) {
    const { error } = await sb.from('partners').upsert(partnerRows)
    if (error) throw error
  }
  if (productRows.length) {
    const { error } = await sb.from('products').upsert(productRows)
    if (error) throw error
  }

  // Soft-delete: remove DB rows missing from snapshot (admin only via RLS)
  const { data: existingPartners, error: ep } = await sb
    .from('partners')
    .select('id')
  if (ep) throw ep
  const keepP = new Set(partnerRows.map((r) => r.id))
  const dropP = (existingPartners ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepP.has(id))
  if (dropP.length) {
    const { error } = await sb.from('partners').delete().in('id', dropP)
    if (error) throw error
  }

  const { data: existingProducts, error: epr } = await sb
    .from('products')
    .select('id')
  if (epr) throw epr
  const keepPr = new Set(productRows.map((r) => r.id))
  const dropPr = (existingProducts ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepPr.has(id))
  if (dropPr.length) {
    const { error } = await sb.from('products').delete().in('id', dropPr)
    if (error) throw error
  }
}

export async function updateProfileUser(user: MasterUser): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  // UUID check — cloud ids are auth uuids
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRe.test(user.id)) {
    throw new Error(
      'Pengguna baru harus dibuat di Supabase Auth terlebih dahulu.',
    )
  }
  const { error } = await sb
    .from('profiles')
    .update({
      name: user.name,
      email: user.email.trim().toLowerCase(),
      role: user.role,
      title: user.title,
      phone: user.phone,
      branch: user.branch,
      department: user.department,
      active: user.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) throw error
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/master/master-cloud.ts
git commit -m "feat(master): cloud load/save adapters for Supabase"
```

---

### Task 6: AuthContext — Supabase + local fallback

**Files:**
- Modify: `src/features/auth/AuthContext.tsx`

**Interfaces:**
- Consumes: `getSupabase`, `isSupabaseConfigured`, `loadProfileByUserId`, `authUserFromProfile`
- Keeps: `login({ email, password, role, remember })`, `logout`, session timeout

- [ ] **Step 1: Update login/logout**

Replace login body:

```ts
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase-client'
import {
  authUserFromProfile,
  loadProfileByUserId,
} from '@/features/master/master-cloud'
import { mapSupabaseError } from '@/features/master/master-cloud'

// inside login callback:
if (!email.trim() || !password.trim()) {
  throw new Error('Email dan kata sandi wajib diisi.')
}

if (isSupabaseConfigured()) {
  const sb = getSupabase()!
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Gagal masuk.')
  }
  let profile
  try {
    profile = await loadProfileByUserId(data.user.id)
  } catch (e) {
    await sb.auth.signOut()
    throw new Error(mapSupabaseError(e))
  }
  if (!profile.active) {
    await sb.auth.signOut()
    throw new Error('Akun nonaktif. Hubungi admin.')
  }
  if (profile.role !== role) {
    await sb.auth.signOut()
    throw new Error(
      `Akun ini untuk peran ${profile.role}. Pilih peran yang sesuai.`,
    )
  }
  const nextUser = authUserFromProfile(profile)
  saveStoredUser(nextUser, remember)
  setUser(nextUser)
  return
}

// existing demo path:
await new Promise((resolve) => setTimeout(resolve, 280))
const account = findDemoAccount(email, password)
// ... unchanged
```

Logout:

```ts
const logout = useCallback(() => {
  clearStoredUser()
  setUser(null)
  if (isSupabaseConfigured()) {
    void getSupabase()?.auth.signOut()
  }
}, [])
```

On mount (optional restore): if configured and `sb.auth.getSession()` has user, reload profile into `AuthUser` (overwrite stale localStorage role). Add `useEffect` once:

```ts
useEffect(() => {
  if (!isSupabaseConfigured()) return
  const sb = getSupabase()
  if (!sb) return
  let cancelled = false
  void (async () => {
    const { data } = await sb.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return
    try {
      const profile = await loadProfileByUserId(uid)
      if (cancelled || !profile.active) return
      const next = authUserFromProfile(profile)
      saveStoredUser(next, true)
      setUser(next)
    } catch {
      // keep local cached user or clear — prefer clearStoredUser + setUser(null)
      clearStoredUser()
      setUser(null)
    }
  })()
  return () => {
    cancelled = true
  }
}, [])
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

- [ ] **Step 3: Manual smoke (local mode)**

Rename/disable `.env.local` temporarily or comment keys → `npm run dev` → login `admin@egabah.local` / `demo123` / role admin still works.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/AuthContext.tsx
git commit -m "feat(auth): Supabase sign-in with profiles role fallback demo"
```

---

### Task 7: MasterProvider cloud hydrate + persist

**Files:**
- Modify: `src/features/master/master-store.tsx`

**Interfaces:**
- Consumes: `isSupabaseConfigured`, `loadMasterCloud`, `saveMasterCloud`, `updateProfileUser`, `mapSupabaseError`
- Produces: same public store API; add `cloudReady: boolean`, `persistError: string | null`

- [ ] **Step 1: Rewrite persist path**

Behavior:

1. Initial state: if **not** configured → `masterRepository.load()` as today; `useEffect` still `masterRepository.save`.
2. If configured → start with empty/seed-empty lists OR last local cache, set `cloudReady=false`, `useEffect` on mount calls `loadMasterCloud()`, then set lists + `cloudReady=true`.
3. Persist effect: when `cloudReady` and configured → debounce 300ms → `saveMasterCloud(snapshot)`; on partner/product changes only (users via dedicated path). On error → `setPersistError(mapSupabaseError(e))` and **do not** wipe UI state.
4. `upsertUser` / `setUserActive` / `removeUser`:
   - local mode: unchanged (local ids `USR-…`)
   - cloud: `removeUser` → soft `active=false` via `updateProfileUser` (no Auth delete); creating without uuid id → set error message, no insert.
5. Render thin error strip if `persistError`:

```tsx
{persistError ? (
  <div className="bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
    {persistError}
  </div>
) : null}
```

Wrap `children` in fragment with banner above (provider wraps app subtree — banner OK at top of provider output).

Debounced save sketch:

```ts
useEffect(() => {
  if (!isSupabaseConfigured()) {
    masterRepository.save({ version: 1, suppliers, customers, products, users, updatedAt: new Date().toISOString() })
    return
  }
  if (!cloudReady) return
  const handle = window.setTimeout(() => {
    void saveMasterCloud({
      version: 1,
      suppliers,
      customers,
      products,
      users,
      updatedAt: new Date().toISOString(),
    })
      .then(() => setPersistError(null))
      .catch((e) => setPersistError(mapSupabaseError(e)))
  }, 300)
  return () => window.clearTimeout(handle)
}, [suppliers, customers, products, users, cloudReady])
```

Note: `users` in `saveMasterCloud` are not written as bulk upsert (profiles are Auth-linked). Either omit users from saveMasterCloud body (already omitted — only partners/products) or call `updateProfileUser` inside user mutators only. **Do not** upsert profiles from full user list in saveMasterCloud.

- [ ] **Step 2: User mutators cloud branch**

```ts
const upsertUser = useCallback(async (data: UserInput, id?: string) => {
  // keep sync signature returning string — call updateProfileUser void
  const nextId = id ?? nextUserId(users)
  const row: MasterUser = { ...data, id: nextId }
  if (isSupabaseConfigured()) {
    try {
      await updateProfileUser(row)
      setPersistError(null)
    } catch (e) {
      setPersistError(mapSupabaseError(e))
      return nextId
    }
  }
  setUsers((prev) => { /* same splice logic */ })
  return nextId
}, [users])
```

If changing to async breaks callers, keep sync UI update + `void updateProfileUser(row).catch(...)`.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/features/master/master-store.tsx
git commit -m "feat(master): hydrate and persist Master via Supabase when configured"
```

---

### Task 8: Docs polish + end-to-end verify

**Files:**
- Modify: `docs/BACKEND.md`
- Modify: spek status if needed

- [ ] **Step 1: Update BACKEND.md**

Add section:

```md
## Supabase DB-A (Master + Auth)

- Env: lihat `.env.example`
- Migrasi: `supabase/migrations/20261030_master_rbac.sql`
- Seed: `docs/supabase-seed-master.md`
- Client: `src/lib/supabase-client.ts`
- Cloud master: `src/features/master/master-cloud.ts`
```

- [ ] **Step 2: Manual verification checklist**

1. **Local:** unset env → demo login + Master CRUD localStorage.
2. **Cloud admin:** `.env.local` set, seeded → login admin → edit produk → Table Editor shows change.
3. **RLS:** as non-admin JWT (login beli), from browser console or REST, `supabase.from('products').update({name:'x'}).eq('id','…')` → error / no row; Master route redirects.
4. **Role change:** admin sets profile role in Table Editor → user re-login → nav matches.
5. `git status` — `.env.local` untracked.

- [ ] **Step 3: Final typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add docs/BACKEND.md
git commit -m "docs: BACKEND Supabase Master RBAC wiring"
```

---

## Spec coverage (self-review)

| Spek | Task |
| --- | --- |
| supabase-js + env | 1 |
| Schema profiles/partners/products | 2 |
| RLS admin write / auth read | 2 |
| Seed Auth + profiles + master | 3 |
| Mappers / MasterSnapshot | 4–5 |
| Auth signIn + profiles.role | 6 |
| Async store hydrate + upsert | 7 |
| Error toast/banner RLS | 7 |
| Fallback local | 6–7 |
| BACKEND docs | 8 |
| Cloudinary upload | Out of scope (env only) |
| Realtime / other modules | Out of scope |

## Placeholder scan

No TBD left; seed SQL must be fully populated from `SEED_*` in Task 3 Step 2.

## Type consistency

- `ProfileRow.role: UserRole` matches Auth + DB enum.
- `loadMasterCloud` / `saveMasterCloud` / `updateProfileUser` names reused in Tasks 5–7.
- `MasterSnapshot` stays `version: 1` from `master-storage.ts`.
