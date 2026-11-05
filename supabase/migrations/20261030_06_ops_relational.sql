-- Ops relational tables (CREATE + indexes + RLS) plus COPY from ops_docs.
-- Depends on auth_can_write_module() from 20261030_02_ops_snapshots.sql.
-- DROP of ops_docs and app_module_snapshots is deferred — not in this file.
-- Pattern: typed scalars + jsonb for small objects; child tables for arrays.
-- Soft FK are text + index (no REFERENCES).
-- Domain ISO timestamps that collide with row metadata use *_label
-- (same idea as stock_* date_label / updated_at_label).
-- TaxSnapshotFields (ppnRate, priceMode, dpp, ppn, totalWithTax) → tax jsonb.

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
  date text not null default '',
  amount numeric not null default 0,
  method text not null default '',
  receipt_name text,
  transfer_proof jsonb,
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
  posted_at text,
  rejected_reason text,
  created_at_label text not null default '',
  tax jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchase_returns_purchase_id_idx
  on public.purchase_returns (purchase_id);
create index if not exists purchase_returns_lot_id_idx
  on public.purchase_returns (lot_id);

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
  broken_pct numeric,
  grade text,
  passed boolean not null default false,
  note text,
  by_actor text, -- LotQc.by
  at text,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lot_qc_lot_id_idx on public.lot_qc (lot_id);
create index if not exists lot_qc_purchase_id_idx on public.lot_qc (purchase_id);

-- ========== PENJUALAN ==========
create table if not exists public.sale_orders (
  id text primary key,
  date text not null default '',
  customer_id text not null default '',
  sku text not null default '',
  product_name text not null default '',
  unit text not null default '',
  qty numeric not null default 0,
  price numeric not null default 0,
  note text,
  stage text not null default '',
  delivery jsonb,
  due_date text,
  lot_id text,
  voided_at text,
  void_reason text,
  tax jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sale_orders_customer_id_idx on public.sale_orders (customer_id);
create index if not exists sale_orders_sku_idx on public.sale_orders (sku);
create index if not exists sale_orders_lot_id_idx on public.sale_orders (lot_id);

create table if not exists public.sale_order_payments (
  id text primary key,
  order_id text not null,
  date text not null default '',
  amount numeric not null default 0,
  method text not null default '',
  receipt_name text,
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
  posted_at text,
  rejected_reason text,
  created_at_label text not null default '',
  tax jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sale_returns_order_id_idx on public.sale_returns (order_id);

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
create index if not exists sale_return_lines_return_id_idx
  on public.sale_return_lines (return_id);

-- ========== PRODUKSI ==========
create table if not exists public.production_batches (
  id text primary key,
  date text not null default '',
  operator text not null default '',
  stage text not null default '',
  input_sku text not null default '',
  input_name text not null default '',
  input_unit text not null default '',
  input_qty numeric not null default 0,
  input_lot_id text,
  from_location text not null default '',
  process_location text not null default '',
  to_location text not null default '',
  target_rendemen numeric not null default 0,
  note text not null default '',
  submitted_at text,
  approved_at text,
  approved_by text,
  rejected_at text,
  reject_reason text,
  started_at text,
  completed_at text,
  voided_at text,
  void_reason text,
  stock_posted boolean not null default false,
  wip_stock_posted boolean,
  wip_grain_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_batches_input_lot_id_idx
  on public.production_batches (input_lot_id);
create index if not exists production_batches_input_sku_idx
  on public.production_batches (input_sku);

create table if not exists public.batch_outputs (
  id text primary key,
  batch_id text not null,
  sku text not null default '',
  product_name text,
  unit text,
  qty numeric not null default 0,
  kind text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists batch_outputs_batch_id_idx on public.batch_outputs (batch_id);
create index if not exists batch_outputs_sku_idx on public.batch_outputs (sku);

create table if not exists public.pack_runs (
  id text primary key,
  batch_id text,
  source_sku text,
  stage text not null default '',
  created_at_label text not null default '',
  posted_at text,
  voided_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pack_runs_batch_id_idx on public.pack_runs (batch_id);

create table if not exists public.pack_run_lines (
  id text primary key,
  pack_run_id text not null,
  sku text not null default '',
  product_name text not null default '',
  unit text not null default '',
  grade text,
  qty numeric not null default 0,
  bags numeric,
  location text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pack_run_lines_pack_run_id_idx
  on public.pack_run_lines (pack_run_id);

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
create index if not exists lot_costs_lot_id_idx on public.lot_costs (lot_id);
create index if not exists lot_costs_batch_id_idx on public.lot_costs (batch_id);

-- ========== KEUANGAN ==========
create table if not exists public.cash_entries (
  id text primary key,
  date text not null default '',
  reference text not null default '',
  description text not null default '',
  category text not null default '',
  direction text not null default '',
  amount numeric not null default 0,
  balance numeric not null default 0,
  actor text not null default '',
  receipt_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payables (
  id text primary key,
  supplier text not null default '',
  invoice text not null default '',
  due_date text not null default '',
  amount numeric not null default 0,
  paid numeric not null default 0,
  status text not null default '',
  aging_days numeric not null default 0,
  receipt_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receivables (
  id text primary key,
  customer text not null default '',
  invoice text not null default '',
  due_date text not null default '',
  amount numeric not null default 0,
  paid numeric not null default 0,
  status text not null default '',
  aging_days numeric not null default 0,
  receipt_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  date text not null default '',
  reference text not null default '',
  category text not null default '',
  description text not null default '',
  amount numeric not null default 0,
  status text not null default '',
  actor text not null default '',
  receipt_name text,
  tax jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== PERIOD ==========
create table if not exists public.period_locks (
  id text primary key,
  kind text not null default '',
  year_month text,
  start_date text not null default '',
  end_date text not null default '',
  active boolean not null default false,
  locked_at text not null default '',
  locked_by text not null default '',
  unlock_history jsonb,
  pending_unlock_request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists period_locks_pending_unlock_request_id_idx
  on public.period_locks (pending_unlock_request_id);

create table if not exists public.period_unlock_requests (
  id text primary key,
  period_lock_id text not null default '',
  reason text not null default '',
  status text not null default '',
  required_roles jsonb,
  approvals jsonb,
  admin_approval jsonb,
  rejected_by text,
  reject_reason text,
  created_at_label text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists period_unlock_requests_period_lock_id_idx
  on public.period_unlock_requests (period_lock_id);

-- ========== BANK ==========
create table if not exists public.bank_sessions (
  id text primary key,
  start_date text not null default '',
  end_date text not null default '',
  cash_account_id text not null default '',
  statement_balance numeric,
  status text not null default '',
  created_at_label text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bank_sessions_cash_account_id_idx
  on public.bank_sessions (cash_account_id);

create table if not exists public.bank_lines (
  id text primary key,
  session_id text not null default '',
  date text not null default '',
  memo text not null default '',
  amount numeric not null default 0,
  bank_ref text,
  status text not null default '',
  cash_entry_id text,
  journal_source_key text,
  suggested_cash_entry_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bank_lines_session_id_idx on public.bank_lines (session_id);
create index if not exists bank_lines_cash_entry_id_idx on public.bank_lines (cash_entry_id);

-- ========== TAX ==========
create table if not exists public.tax_settings (
  id text primary key, -- singleton 'settings'
  npwp text not null default '',
  invoice_prefix text not null default '',
  next_seq numeric not null default 1,
  default_rate numeric not null default 11,
  default_price_mode text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_docs (
  id text primary key,
  source_type text not null default '',
  source_id text not null default '',
  date text not null default '',
  ppn_rate numeric not null default 0,
  price_mode text not null default '',
  dpp numeric not null default 0,
  ppn numeric not null default 0,
  total numeric not null default 0,
  party_name text,
  note text,
  supplier_faktur_no text,
  created_at_label text not null default '',
  voided_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tax_docs_source_idx
  on public.tax_docs (source_type, source_id);

create table if not exists public.tax_invoices (
  id text primary key,
  number text not null default '',
  tax_doc_id text not null default '',
  sale_order_id text not null default '',
  status text not null default '',
  sent_at text,
  fail_reason text,
  dpp numeric not null default 0,
  ppn numeric not null default 0,
  total numeric not null default 0,
  date text not null default '',
  party_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tax_invoices_tax_doc_id_idx on public.tax_invoices (tax_doc_id);
create index if not exists tax_invoices_sale_order_id_idx on public.tax_invoices (sale_order_id);

-- ========== GL ==========
create table if not exists public.gl_accounts (
  id text primary key,
  code text not null default '',
  name text not null default '',
  type text not null default '',
  parent_id text,
  is_postable boolean not null default false,
  active boolean not null default false,
  system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gl_accounts_parent_id_idx on public.gl_accounts (parent_id);
create index if not exists gl_accounts_code_idx on public.gl_accounts (code);

create table if not exists public.gl_account_map (
  id text primary key, -- singleton 'map'
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gl_journals (
  id text primary key,
  date text not null default '',
  memo text not null default '',
  source_key text,
  source_type text not null default '',
  manual boolean not null default false,
  created_by text not null default '',
  created_at_label text not null default '',
  voided_at text,
  reverses_id text,
  reversed_by_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gl_journals_source_key_idx on public.gl_journals (source_key);
create index if not exists gl_journals_reverses_id_idx on public.gl_journals (reverses_id);

create table if not exists public.gl_journal_lines (
  id text primary key, -- synthetic: journal has no line id in TS
  journal_id text not null,
  account_id text not null default '',
  debit numeric not null default 0,
  credit numeric not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gl_journal_lines_journal_id_idx
  on public.gl_journal_lines (journal_id);
create index if not exists gl_journal_lines_account_id_idx
  on public.gl_journal_lines (account_id);

create table if not exists public.gl_failed_posts (
  id text primary key, -- = source_key
  source_key text not null,
  payload jsonb,
  error text not null default '',
  created_at_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists gl_failed_posts_source_key_idx
  on public.gl_failed_posts (source_key);

-- ========== PAYROLL ==========
create table if not exists public.payroll_runs (
  id text primary key,
  period text not null default '',
  status text not null default '',
  created_at_label text not null default '',
  posted_at text,
  voided_at text,
  actor text not null default '',
  note text not null default '',
  approvals jsonb,
  transfer_proof jsonb,
  mutation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_lines (
  id text primary key, -- synthetic: line has no id in TS
  run_id text not null,
  user_id text not null default '',
  name text not null default '',
  role text not null default '',
  base numeric not null default 0,
  allowance numeric not null default 0,
  deduction numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payroll_lines_run_id_idx on public.payroll_lines (run_id);
create index if not exists payroll_lines_user_id_idx on public.payroll_lines (user_id);

-- ========== AUDIT ==========
create table if not exists public.audit_logs (
  id text primary key,
  at text not null default '',
  actor text not null default '',
  action text not null default '',
  entity text not null default '',
  entity_id text not null default '',
  before_doc jsonb,
  after_doc jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_id_idx on public.audit_logs (entity, entity_id);
create index if not exists audit_logs_at_idx on public.audit_logs (at);

-- ========== RLS ==========
create or replace function public.enable_ops_table_rls(p_table text, p_module text)
returns void
language plpgsql
set search_path = public
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
select public.enable_ops_table_rls('purchase_returns', 'pembelian');
select public.enable_ops_table_rls('purchase_return_lines', 'pembelian');
select public.enable_ops_table_rls('lot_qc', 'pembelian');
select public.enable_ops_table_rls('sale_orders', 'penjualan');
select public.enable_ops_table_rls('sale_order_payments', 'penjualan');
select public.enable_ops_table_rls('sale_returns', 'penjualan');
select public.enable_ops_table_rls('sale_return_lines', 'penjualan');
select public.enable_ops_table_rls('production_batches', 'produksi');
select public.enable_ops_table_rls('batch_outputs', 'produksi');
select public.enable_ops_table_rls('pack_runs', 'produksi');
select public.enable_ops_table_rls('pack_run_lines', 'produksi');
select public.enable_ops_table_rls('lot_costs', 'produksi');
select public.enable_ops_table_rls('cash_entries', 'keuangan');
select public.enable_ops_table_rls('payables', 'keuangan');
select public.enable_ops_table_rls('receivables', 'keuangan');
select public.enable_ops_table_rls('expenses', 'keuangan');
select public.enable_ops_table_rls('period_locks', 'period');
select public.enable_ops_table_rls('period_unlock_requests', 'period');
select public.enable_ops_table_rls('bank_sessions', 'bank');
select public.enable_ops_table_rls('bank_lines', 'bank');
select public.enable_ops_table_rls('tax_settings', 'tax');
select public.enable_ops_table_rls('tax_docs', 'tax');
select public.enable_ops_table_rls('tax_invoices', 'tax');
select public.enable_ops_table_rls('gl_accounts', 'gl');
select public.enable_ops_table_rls('gl_account_map', 'gl');
select public.enable_ops_table_rls('gl_journals', 'gl');
select public.enable_ops_table_rls('gl_journal_lines', 'gl');
select public.enable_ops_table_rls('gl_failed_posts', 'gl');
select public.enable_ops_table_rls('payroll_runs', 'payroll');
select public.enable_ops_table_rls('payroll_lines', 'payroll');
select public.enable_ops_table_rls('audit_logs', 'audit');

revoke all on function public.enable_ops_table_rls(text, text) from public, anon, authenticated, service_role;

-- ========== COPY FROM ops_docs ==========
-- Snapshot copy into the tables above. Re-run truncates those tables and
-- refills them from ops_docs. Does not DROP ops_docs or app_module_snapshots.
-- Domain createdAt ISO strings go to created_at_label. Row created_at and
-- updated_at stay timestamptz defaults (the domain string is never cast
-- into them). Child rows keep elem.id when present; otherwise
-- parent_id || '-' || ordinal (jsonb WITH ORDINALITY, 1-based).
-- Column list follows this file's DDL, not the plan starter snippet.

begin;

create or replace function public.ops_copy_num(raw text, fallback numeric)
returns numeric
language sql
immutable
set search_path = pg_catalog
as $fn$
  select case
    when raw is null or btrim(raw) = '' then fallback
    when btrim(raw) ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then btrim(raw)::numeric
    else fallback
  end;
$fn$;

create or replace function public.ops_copy_bool(raw text, fallback boolean)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $fn$
  select case lower(btrim(coalesce(raw, '')))
    when 'true' then true
    when 't' then true
    when '1' then true
    when 'false' then false
    when 'f' then false
    when '0' then false
    else fallback
  end;
$fn$;

create or replace function public.ops_copy_tax(doc jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $fn$
  select case
    when doc ?| array['ppnRate', 'priceMode', 'dpp', 'ppn', 'totalWithTax']
    then jsonb_strip_nulls(jsonb_build_object(
      'ppnRate', doc->'ppnRate',
      'priceMode', doc->'priceMode',
      'dpp', doc->'dpp',
      'ppn', doc->'ppn',
      'totalWithTax', doc->'totalWithTax'
    ))
    else null
  end;
$fn$;

create or replace function public.ops_copy_arr(doc jsonb, key text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $fn$
  select case
    when jsonb_typeof(doc -> key) = 'array' then doc -> key
    else '[]'::jsonb
  end;
$fn$;

create or replace function public.ops_copy_json(doc jsonb, key text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $fn$
  select case
    when doc ? key and jsonb_typeof(doc -> key) is distinct from 'null'
    then doc -> key
    else null
  end;
$fn$;

create or replace function public.ops_copy_child_id(parent_id text, elem jsonb, ord bigint)
returns text
language sql
immutable
set search_path = pg_catalog
as $fn$
  select coalesce(nullif(elem->>'id', ''), parent_id || '-' || ord::text);
$fn$;

create temp table _ops_copy_src_count on commit drop as
select count(*)::bigint as n from public.ops_docs;

do $pre$
declare
  rec record;
  n bigint;
  bad text := '';
begin
  for rec in
    select * from (values
      ('pembelian', 'purchases', 'payments', 'purchase_payments'),
      ('pembelian', 'returns', 'lines', 'purchase_return_lines'),
      ('penjualan', 'orders', 'payments', 'sale_order_payments'),
      ('penjualan', 'returns', 'lines', 'sale_return_lines'),
      ('produksi', 'batches', 'outputs', 'batch_outputs'),
      ('produksi', 'pack_runs', 'lines', 'pack_run_lines'),
      ('gl', 'journals', 'lines', 'gl_journal_lines'),
      ('payroll', 'runs', 'lines', 'payroll_lines')
    ) as v(mod, coll, arr, child)
  loop
    execute format(
      $q$
      select count(*) from (
        select public.ops_copy_child_id(d.id, t.elem, t.ord) as cid
        from public.ops_docs d
        cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, %L))
          with ordinality as t(elem, ord)
        where d.module = %L
          and d.collection = %L
          and nullif(d.id, '') is not null
        group by 1
        having count(*) > 1
      ) s
      $q$,
      rec.arr, rec.mod, rec.coll
    ) into n;
    if n > 0 then
      bad := bad || format('%s duplicate child ids (%s); ', rec.child, n);
    end if;
  end loop;

  select count(*) into n from (
    select coalesce(nullif(doc->>'sourceKey', ''), id) as nk
    from public.ops_docs
    where module = 'gl' and collection = 'failed_posts' and nullif(id, '') is not null
    group by 1
    having count(*) > 1
  ) s;
  if n > 0 then
    bad := bad || format('gl_failed_posts duplicate source_key (%s); ', n);
  end if;

  if bad <> '' then
    raise exception 'ops copy preflight: %', bad;
  end if;
end
$pre$;

truncate table
  public.purchase_payments,
  public.purchase_return_lines,
  public.sale_order_payments,
  public.sale_return_lines,
  public.batch_outputs,
  public.pack_run_lines,
  public.gl_journal_lines,
  public.payroll_lines,
  public.purchases,
  public.purchase_returns,
  public.lot_qc,
  public.sale_orders,
  public.sale_returns,
  public.production_batches,
  public.pack_runs,
  public.lot_costs,
  public.cash_entries,
  public.payables,
  public.receivables,
  public.expenses,
  public.period_locks,
  public.period_unlock_requests,
  public.bank_sessions,
  public.bank_lines,
  public.tax_settings,
  public.tax_docs,
  public.tax_invoices,
  public.gl_accounts,
  public.gl_account_map,
  public.gl_journals,
  public.gl_failed_posts,
  public.payroll_runs,
  public.audit_logs;

insert into public.purchases (
  id, date, supplier_id, grain, sacks, estimated_kg, price, effective_price,
  lot_id, vehicle, note, stage, weighing, due_date, invoice_proof, purchase_proof,
  approvals, reject_reason, budget_approved_at, completed_at, voided_at, void_reason, tax
)
select
  d.id,
  coalesce(d.doc->>'date', ''),
  coalesce(d.doc->>'supplierId', ''),
  coalesce(d.doc->>'grain', ''),
  public.ops_copy_num(d.doc->>'sacks', 0),
  public.ops_copy_num(d.doc->>'estimatedKg', 0),
  public.ops_copy_num(d.doc->>'price', 0),
  public.ops_copy_num(d.doc->>'effectivePrice', null::numeric),
  nullif(d.doc->>'lotId', ''),
  nullif(d.doc->>'vehicle', ''),
  nullif(d.doc->>'note', ''),
  coalesce(d.doc->>'stage', ''),
  public.ops_copy_json(d.doc, 'weighing'),
  nullif(d.doc->>'dueDate', ''),
  public.ops_copy_json(d.doc, 'invoiceProof'),
  public.ops_copy_json(d.doc, 'purchaseProof'),
  public.ops_copy_json(d.doc, 'approvals'),
  nullif(d.doc->>'rejectReason', ''),
  nullif(d.doc->>'budgetApprovedAt', ''),
  nullif(d.doc->>'completedAt', ''),
  nullif(d.doc->>'voidedAt', ''),
  nullif(d.doc->>'voidReason', ''),
  public.ops_copy_tax(d.doc)
from public.ops_docs d
where d.module = 'pembelian' and d.collection = 'purchases' and nullif(d.id, '') is not null;

insert into public.purchase_payments (
  id, purchase_id, date, amount, method, receipt_name, transfer_proof
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'date', ''),
  public.ops_copy_num(p.elem->>'amount', 0),
  coalesce(p.elem->>'method', ''),
  nullif(p.elem->>'receiptName', ''),
  public.ops_copy_json(p.elem, 'transferProof')
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'payments'))
  with ordinality as p(elem, ord)
where d.module = 'pembelian' and d.collection = 'purchases' and nullif(d.id, '') is not null;

insert into public.purchase_returns (
  id, purchase_id, lot_id, reason, stage, approvals, posted_at, rejected_reason,
  created_at_label, tax
)
select
  d.id,
  coalesce(d.doc->>'purchaseId', ''),
  nullif(d.doc->>'lotId', ''),
  coalesce(d.doc->>'reason', ''),
  coalesce(d.doc->>'stage', ''),
  public.ops_copy_json(d.doc, 'approvals'),
  nullif(d.doc->>'postedAt', ''),
  nullif(d.doc->>'rejectedReason', ''),
  coalesce(d.doc->>'createdAt', ''),
  public.ops_copy_tax(d.doc)
from public.ops_docs d
where d.module = 'pembelian' and d.collection = 'returns' and nullif(d.id, '') is not null;

insert into public.purchase_return_lines (
  id, return_id, sku, product_name, unit, qty
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'sku', ''),
  coalesce(p.elem->>'productName', ''),
  coalesce(p.elem->>'unit', 'kg'),
  public.ops_copy_num(p.elem->>'qty', 0)
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'lines'))
  with ordinality as p(elem, ord)
where d.module = 'pembelian' and d.collection = 'returns' and nullif(d.id, '') is not null;

insert into public.lot_qc (
  id, lot_id, purchase_id, moisture, impurity, broken_pct, grade, passed, note,
  by_actor, at, override_reason
)
select
  d.id,
  coalesce(nullif(d.doc->>'lotId', ''), d.id),
  coalesce(d.doc->>'purchaseId', ''),
  public.ops_copy_num(d.doc->>'moisture', null::numeric),
  public.ops_copy_num(d.doc->>'impurity', null::numeric),
  public.ops_copy_num(d.doc->>'brokenPct', null::numeric),
  nullif(d.doc->>'grade', ''),
  public.ops_copy_bool(d.doc->>'passed', false),
  nullif(d.doc->>'note', ''),
  nullif(d.doc->>'by', ''),
  nullif(d.doc->>'at', ''),
  nullif(d.doc->>'overrideReason', '')
from public.ops_docs d
where d.module = 'pembelian' and d.collection = 'lot_qc' and nullif(d.id, '') is not null;

insert into public.sale_orders (
  id, date, customer_id, sku, product_name, unit, qty, price, note, stage,
  delivery, due_date, lot_id, voided_at, void_reason, tax
)
select
  d.id,
  coalesce(d.doc->>'date', ''),
  coalesce(d.doc->>'customerId', ''),
  coalesce(d.doc->>'sku', ''),
  coalesce(d.doc->>'productName', ''),
  coalesce(d.doc->>'unit', ''),
  public.ops_copy_num(d.doc->>'qty', 0),
  public.ops_copy_num(d.doc->>'price', 0),
  nullif(d.doc->>'note', ''),
  coalesce(d.doc->>'stage', ''),
  public.ops_copy_json(d.doc, 'delivery'),
  nullif(d.doc->>'dueDate', ''),
  nullif(d.doc->>'lotId', ''),
  nullif(d.doc->>'voidedAt', ''),
  nullif(d.doc->>'voidReason', ''),
  public.ops_copy_tax(d.doc)
from public.ops_docs d
where d.module = 'penjualan' and d.collection = 'orders' and nullif(d.id, '') is not null;

insert into public.sale_order_payments (
  id, order_id, date, amount, method, receipt_name
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'date', ''),
  public.ops_copy_num(p.elem->>'amount', 0),
  coalesce(p.elem->>'method', ''),
  nullif(p.elem->>'receiptName', '')
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'payments'))
  with ordinality as p(elem, ord)
where d.module = 'penjualan' and d.collection = 'orders' and nullif(d.id, '') is not null;

insert into public.sale_returns (
  id, order_id, reason, stage, approvals, posted_at, rejected_reason, created_at_label, tax
)
select
  d.id,
  coalesce(d.doc->>'orderId', ''),
  coalesce(d.doc->>'reason', ''),
  coalesce(d.doc->>'stage', ''),
  public.ops_copy_json(d.doc, 'approvals'),
  nullif(d.doc->>'postedAt', ''),
  nullif(d.doc->>'rejectedReason', ''),
  coalesce(d.doc->>'createdAt', ''),
  public.ops_copy_tax(d.doc)
from public.ops_docs d
where d.module = 'penjualan' and d.collection = 'returns' and nullif(d.id, '') is not null;

insert into public.sale_return_lines (
  id, return_id, sku, product_name, unit, qty
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'sku', ''),
  coalesce(p.elem->>'productName', ''),
  coalesce(p.elem->>'unit', 'kg'),
  public.ops_copy_num(p.elem->>'qty', 0)
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'lines'))
  with ordinality as p(elem, ord)
where d.module = 'penjualan' and d.collection = 'returns' and nullif(d.id, '') is not null;

insert into public.production_batches (
  id, date, operator, stage, input_sku, input_name, input_unit, input_qty, input_lot_id,
  from_location, process_location, to_location, target_rendemen, note,
  submitted_at, approved_at, approved_by, rejected_at, reject_reason,
  started_at, completed_at, voided_at, void_reason,
  stock_posted, wip_stock_posted, wip_grain_value
)
select
  d.id,
  coalesce(d.doc->>'date', ''),
  coalesce(d.doc->>'operator', ''),
  coalesce(d.doc->>'stage', ''),
  coalesce(d.doc->>'inputSku', ''),
  coalesce(d.doc->>'inputName', ''),
  coalesce(d.doc->>'inputUnit', ''),
  public.ops_copy_num(d.doc->>'inputQty', 0),
  nullif(d.doc->>'inputLotId', ''),
  coalesce(d.doc->>'fromLocation', ''),
  coalesce(d.doc->>'processLocation', ''),
  coalesce(d.doc->>'toLocation', ''),
  public.ops_copy_num(d.doc->>'targetRendemen', 0),
  coalesce(d.doc->>'note', ''),
  nullif(d.doc->>'submittedAt', ''),
  nullif(d.doc->>'approvedAt', ''),
  nullif(d.doc->>'approvedBy', ''),
  nullif(d.doc->>'rejectedAt', ''),
  nullif(d.doc->>'rejectReason', ''),
  nullif(d.doc->>'startedAt', ''),
  nullif(d.doc->>'completedAt', ''),
  nullif(d.doc->>'voidedAt', ''),
  nullif(d.doc->>'voidReason', ''),
  public.ops_copy_bool(d.doc->>'stockPosted', false),
  public.ops_copy_bool(d.doc->>'wipStockPosted', null::boolean),
  public.ops_copy_num(d.doc->>'wipGrainValue', null::numeric)
from public.ops_docs d
where d.module = 'produksi' and d.collection = 'batches' and nullif(d.id, '') is not null;

insert into public.batch_outputs (
  id, batch_id, sku, product_name, unit, qty, kind
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'sku', ''),
  nullif(p.elem->>'productName', ''),
  nullif(p.elem->>'unit', ''),
  public.ops_copy_num(p.elem->>'qty', 0),
  nullif(p.elem->>'kind', '')
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'outputs'))
  with ordinality as p(elem, ord)
where d.module = 'produksi' and d.collection = 'batches' and nullif(d.id, '') is not null;

insert into public.pack_runs (
  id, batch_id, source_sku, stage, created_at_label, posted_at, voided_at
)
select
  d.id,
  nullif(d.doc->>'batchId', ''),
  nullif(d.doc->>'sourceSku', ''),
  coalesce(d.doc->>'stage', ''),
  coalesce(d.doc->>'createdAt', ''),
  nullif(d.doc->>'postedAt', ''),
  nullif(d.doc->>'voidedAt', '')
from public.ops_docs d
where d.module = 'produksi' and d.collection = 'pack_runs' and nullif(d.id, '') is not null;

insert into public.pack_run_lines (
  id, pack_run_id, sku, product_name, unit, grade, qty, bags, location
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'sku', ''),
  coalesce(p.elem->>'productName', ''),
  coalesce(p.elem->>'unit', ''),
  nullif(p.elem->>'grade', ''),
  public.ops_copy_num(p.elem->>'qty', 0),
  public.ops_copy_num(p.elem->>'bags', null::numeric),
  coalesce(p.elem->>'location', '')
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'lines'))
  with ordinality as p(elem, ord)
where d.module = 'produksi' and d.collection = 'pack_runs' and nullif(d.id, '') is not null;

insert into public.lot_costs (
  id, lot_id, batch_id, grain_value, allocated_ops, beras_qty, cost_per_kg_beras, method, at
)
select
  d.id,
  coalesce(nullif(d.doc->>'lotId', ''), d.id),
  nullif(d.doc->>'batchId', ''),
  public.ops_copy_num(d.doc->>'grainValue', null::numeric),
  public.ops_copy_num(d.doc->>'allocatedOps', null::numeric),
  public.ops_copy_num(d.doc->>'berasQty', null::numeric),
  public.ops_copy_num(d.doc->>'costPerKgBeras', null::numeric),
  nullif(d.doc->>'method', ''),
  nullif(d.doc->>'at', '')
from public.ops_docs d
where d.module = 'produksi' and d.collection = 'lot_costs' and nullif(d.id, '') is not null;

insert into public.cash_entries (
  id, date, reference, description, category, direction, amount, balance, actor, receipt_name
)
select
  d.id,
  coalesce(d.doc->>'date', ''),
  coalesce(d.doc->>'reference', ''),
  coalesce(d.doc->>'description', ''),
  coalesce(d.doc->>'category', ''),
  coalesce(d.doc->>'direction', ''),
  public.ops_copy_num(d.doc->>'amount', 0),
  public.ops_copy_num(d.doc->>'balance', 0),
  coalesce(d.doc->>'actor', ''),
  nullif(d.doc->>'receiptName', '')
from public.ops_docs d
where d.module = 'keuangan' and d.collection = 'cash_entries' and nullif(d.id, '') is not null;

insert into public.payables (
  id, supplier, invoice, due_date, amount, paid, status, aging_days, receipt_name
)
select
  d.id,
  coalesce(d.doc->>'supplier', ''),
  coalesce(d.doc->>'invoice', ''),
  coalesce(d.doc->>'dueDate', ''),
  public.ops_copy_num(d.doc->>'amount', 0),
  public.ops_copy_num(d.doc->>'paid', 0),
  coalesce(d.doc->>'status', ''),
  public.ops_copy_num(d.doc->>'agingDays', 0),
  nullif(d.doc->>'receiptName', '')
from public.ops_docs d
where d.module = 'keuangan' and d.collection = 'payables' and nullif(d.id, '') is not null;

insert into public.receivables (
  id, customer, invoice, due_date, amount, paid, status, aging_days, receipt_name
)
select
  d.id,
  coalesce(d.doc->>'customer', ''),
  coalesce(d.doc->>'invoice', ''),
  coalesce(d.doc->>'dueDate', ''),
  public.ops_copy_num(d.doc->>'amount', 0),
  public.ops_copy_num(d.doc->>'paid', 0),
  coalesce(d.doc->>'status', ''),
  public.ops_copy_num(d.doc->>'agingDays', 0),
  nullif(d.doc->>'receiptName', '')
from public.ops_docs d
where d.module = 'keuangan' and d.collection = 'receivables' and nullif(d.id, '') is not null;

insert into public.expenses (
  id, date, reference, category, description, amount, status, actor, receipt_name, tax
)
select
  d.id,
  coalesce(d.doc->>'date', ''),
  coalesce(d.doc->>'reference', ''),
  coalesce(d.doc->>'category', ''),
  coalesce(d.doc->>'description', ''),
  public.ops_copy_num(d.doc->>'amount', 0),
  coalesce(d.doc->>'status', ''),
  coalesce(d.doc->>'actor', ''),
  nullif(d.doc->>'receiptName', ''),
  public.ops_copy_tax(d.doc)
from public.ops_docs d
where d.module = 'keuangan' and d.collection = 'expenses' and nullif(d.id, '') is not null;

insert into public.period_locks (
  id, kind, year_month, start_date, end_date, active, locked_at, locked_by,
  unlock_history, pending_unlock_request_id
)
select
  d.id,
  coalesce(d.doc->>'kind', ''),
  nullif(d.doc->>'yearMonth', ''),
  coalesce(d.doc->>'startDate', ''),
  coalesce(d.doc->>'endDate', ''),
  public.ops_copy_bool(d.doc->>'active', false),
  coalesce(d.doc->>'lockedAt', ''),
  coalesce(d.doc->>'lockedBy', ''),
  public.ops_copy_json(d.doc, 'unlockHistory'),
  nullif(d.doc->>'pendingUnlockRequestId', '')
from public.ops_docs d
where d.module = 'period' and d.collection = 'locks' and nullif(d.id, '') is not null;

insert into public.period_unlock_requests (
  id, period_lock_id, reason, status, required_roles, approvals, admin_approval,
  rejected_by, reject_reason, created_at_label, created_by
)
select
  d.id,
  coalesce(d.doc->>'periodLockId', ''),
  coalesce(d.doc->>'reason', ''),
  coalesce(d.doc->>'status', ''),
  public.ops_copy_json(d.doc, 'requiredRoles'),
  public.ops_copy_json(d.doc, 'approvals'),
  public.ops_copy_json(d.doc, 'adminApproval'),
  nullif(d.doc->>'rejectedBy', ''),
  nullif(d.doc->>'rejectReason', ''),
  coalesce(d.doc->>'createdAt', ''),
  coalesce(d.doc->>'createdBy', '')
from public.ops_docs d
where d.module = 'period' and d.collection = 'unlock_requests' and nullif(d.id, '') is not null;

insert into public.bank_sessions (
  id, start_date, end_date, cash_account_id, statement_balance, status,
  created_at_label, created_by
)
select
  d.id,
  coalesce(d.doc->>'startDate', ''),
  coalesce(d.doc->>'endDate', ''),
  coalesce(d.doc->>'cashAccountId', ''),
  public.ops_copy_num(d.doc->>'statementBalance', null::numeric),
  coalesce(d.doc->>'status', ''),
  coalesce(d.doc->>'createdAt', ''),
  coalesce(d.doc->>'createdBy', '')
from public.ops_docs d
where d.module = 'bank' and d.collection = 'sessions' and nullif(d.id, '') is not null;

insert into public.bank_lines (
  id, session_id, date, memo, amount, bank_ref, status, cash_entry_id,
  journal_source_key, suggested_cash_entry_id
)
select
  d.id,
  coalesce(d.doc->>'sessionId', ''),
  coalesce(d.doc->>'date', ''),
  coalesce(d.doc->>'memo', ''),
  public.ops_copy_num(d.doc->>'amount', 0),
  nullif(d.doc->>'bankRef', ''),
  coalesce(d.doc->>'status', ''),
  nullif(d.doc->>'cashEntryId', ''),
  nullif(d.doc->>'journalSourceKey', ''),
  nullif(d.doc->>'suggestedCashEntryId', '')
from public.ops_docs d
where d.module = 'bank' and d.collection = 'lines' and nullif(d.id, '') is not null;

insert into public.tax_settings (
  id, npwp, invoice_prefix, next_seq, default_rate, default_price_mode
)
select
  d.id,
  coalesce(d.doc->>'npwp', ''),
  coalesce(d.doc->>'invoicePrefix', ''),
  public.ops_copy_num(d.doc->>'nextSeq', 1),
  public.ops_copy_num(d.doc->>'defaultRate', 11),
  coalesce(d.doc->>'defaultPriceMode', '')
from public.ops_docs d
where d.module = 'tax' and d.collection = 'settings' and nullif(d.id, '') is not null;

insert into public.tax_docs (
  id, source_type, source_id, date, ppn_rate, price_mode, dpp, ppn, total,
  party_name, note, supplier_faktur_no, created_at_label, voided_at
)
select
  d.id,
  coalesce(d.doc->>'sourceType', ''),
  coalesce(d.doc->>'sourceId', ''),
  coalesce(d.doc->>'date', ''),
  public.ops_copy_num(d.doc->>'ppnRate', 0),
  coalesce(d.doc->>'priceMode', ''),
  public.ops_copy_num(d.doc->>'dpp', 0),
  public.ops_copy_num(d.doc->>'ppn', 0),
  public.ops_copy_num(d.doc->>'total', 0),
  nullif(d.doc->>'partyName', ''),
  nullif(d.doc->>'note', ''),
  nullif(d.doc->>'supplierFakturNo', ''),
  coalesce(d.doc->>'createdAt', ''),
  nullif(d.doc->>'voidedAt', '')
from public.ops_docs d
where d.module = 'tax' and d.collection = 'docs' and nullif(d.id, '') is not null;

insert into public.tax_invoices (
  id, number, tax_doc_id, sale_order_id, status, sent_at, fail_reason,
  dpp, ppn, total, date, party_name
)
select
  d.id,
  coalesce(d.doc->>'number', ''),
  coalesce(d.doc->>'taxDocId', ''),
  coalesce(d.doc->>'saleOrderId', ''),
  coalesce(d.doc->>'status', ''),
  nullif(d.doc->>'sentAt', ''),
  nullif(d.doc->>'failReason', ''),
  public.ops_copy_num(d.doc->>'dpp', 0),
  public.ops_copy_num(d.doc->>'ppn', 0),
  public.ops_copy_num(d.doc->>'total', 0),
  coalesce(d.doc->>'date', ''),
  nullif(d.doc->>'partyName', '')
from public.ops_docs d
where d.module = 'tax' and d.collection = 'invoices' and nullif(d.id, '') is not null;

insert into public.gl_accounts (
  id, code, name, type, parent_id, is_postable, active, system
)
select
  d.id,
  coalesce(d.doc->>'code', ''),
  coalesce(d.doc->>'name', ''),
  coalesce(d.doc->>'type', ''),
  nullif(d.doc->>'parentId', ''),
  public.ops_copy_bool(d.doc->>'isPostable', false),
  public.ops_copy_bool(d.doc->>'active', false),
  public.ops_copy_bool(d.doc->>'system', false)
from public.ops_docs d
where d.module = 'gl' and d.collection = 'accounts' and nullif(d.id, '') is not null;

insert into public.gl_account_map (id, value)
select
  d.id,
  coalesce(public.ops_copy_json(d.doc, 'value'), '{}'::jsonb)
from public.ops_docs d
where d.module = 'gl' and d.collection = 'account_map' and nullif(d.id, '') is not null;

insert into public.gl_journals (
  id, date, memo, source_key, source_type, manual, created_by, created_at_label,
  voided_at, reverses_id, reversed_by_id
)
select
  d.id,
  coalesce(d.doc->>'date', ''),
  coalesce(d.doc->>'memo', ''),
  nullif(d.doc->>'sourceKey', ''),
  coalesce(d.doc->>'sourceType', ''),
  public.ops_copy_bool(d.doc->>'manual', false),
  coalesce(d.doc->>'createdBy', ''),
  coalesce(d.doc->>'createdAt', ''),
  nullif(d.doc->>'voidedAt', ''),
  nullif(d.doc->>'reversesId', ''),
  nullif(d.doc->>'reversedById', '')
from public.ops_docs d
where d.module = 'gl' and d.collection = 'journals' and nullif(d.id, '') is not null;

insert into public.gl_journal_lines (
  id, journal_id, account_id, debit, credit, memo
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'accountId', ''),
  public.ops_copy_num(p.elem->>'debit', 0),
  public.ops_copy_num(p.elem->>'credit', 0),
  nullif(p.elem->>'memo', '')
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'lines'))
  with ordinality as p(elem, ord)
where d.module = 'gl' and d.collection = 'journals' and nullif(d.id, '') is not null;

insert into public.gl_failed_posts (
  id, source_key, payload, error, created_at_label
)
select
  d.id,
  coalesce(nullif(d.doc->>'sourceKey', ''), d.id),
  public.ops_copy_json(d.doc, 'payload'),
  coalesce(d.doc->>'error', ''),
  coalesce(d.doc->>'createdAt', '')
from public.ops_docs d
where d.module = 'gl' and d.collection = 'failed_posts' and nullif(d.id, '') is not null;

insert into public.payroll_runs (
  id, period, status, created_at_label, posted_at, voided_at, actor, note,
  approvals, transfer_proof, mutation_note
)
select
  d.id,
  coalesce(d.doc->>'period', ''),
  coalesce(d.doc->>'status', ''),
  coalesce(d.doc->>'createdAt', ''),
  nullif(d.doc->>'postedAt', ''),
  nullif(d.doc->>'voidedAt', ''),
  coalesce(d.doc->>'actor', ''),
  coalesce(d.doc->>'note', ''),
  public.ops_copy_json(d.doc, 'approvals'),
  public.ops_copy_json(d.doc, 'transferProof'),
  nullif(d.doc->>'mutationNote', '')
from public.ops_docs d
where d.module = 'payroll' and d.collection = 'runs' and nullif(d.id, '') is not null;

insert into public.payroll_lines (
  id, run_id, user_id, name, role, base, allowance, deduction, note
)
select
  public.ops_copy_child_id(d.id, p.elem, p.ord),
  d.id,
  coalesce(p.elem->>'userId', ''),
  coalesce(p.elem->>'name', ''),
  coalesce(p.elem->>'role', ''),
  public.ops_copy_num(p.elem->>'base', 0),
  public.ops_copy_num(p.elem->>'allowance', 0),
  public.ops_copy_num(p.elem->>'deduction', 0),
  coalesce(p.elem->>'note', '')
from public.ops_docs d
cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'lines'))
  with ordinality as p(elem, ord)
where d.module = 'payroll' and d.collection = 'runs' and nullif(d.id, '') is not null;

insert into public.audit_logs (
  id, at, actor, action, entity, entity_id, before_doc, after_doc, note
)
select
  d.id,
  coalesce(d.doc->>'at', ''),
  coalesce(d.doc->>'actor', ''),
  coalesce(d.doc->>'action', ''),
  coalesce(d.doc->>'entity', ''),
  coalesce(d.doc->>'entityId', ''),
  public.ops_copy_json(d.doc, 'before'),
  public.ops_copy_json(d.doc, 'after'),
  nullif(d.doc->>'note', '')
from public.ops_docs d
where d.module = 'audit' and d.collection = 'logs' and nullif(d.id, '') is not null;

do $chk$
declare
  rec record;
  exp bigint;
  act bigint;
  expn numeric;
  actn numeric;
  bad text := '';
begin
  if to_regclass('public.ops_docs') is null then
    bad := bad || 'ops_docs missing; ';
  end if;
  if to_regclass('public.app_module_snapshots') is null then
    bad := bad || 'app_module_snapshots missing; ';
  end if;

  select n into exp from _ops_copy_src_count;
  select count(*) into act from public.ops_docs;
  if exp is distinct from act then
    bad := bad || format('ops_docs count %s -> %s; ', exp, act);
  end if;

  for rec in
    select * from (values
      ('pembelian', 'purchases', 'purchases'),
      ('pembelian', 'returns', 'purchase_returns'),
      ('pembelian', 'lot_qc', 'lot_qc'),
      ('penjualan', 'orders', 'sale_orders'),
      ('penjualan', 'returns', 'sale_returns'),
      ('produksi', 'batches', 'production_batches'),
      ('produksi', 'pack_runs', 'pack_runs'),
      ('produksi', 'lot_costs', 'lot_costs'),
      ('keuangan', 'cash_entries', 'cash_entries'),
      ('keuangan', 'payables', 'payables'),
      ('keuangan', 'receivables', 'receivables'),
      ('keuangan', 'expenses', 'expenses'),
      ('period', 'locks', 'period_locks'),
      ('period', 'unlock_requests', 'period_unlock_requests'),
      ('bank', 'sessions', 'bank_sessions'),
      ('bank', 'lines', 'bank_lines'),
      ('tax', 'settings', 'tax_settings'),
      ('tax', 'docs', 'tax_docs'),
      ('tax', 'invoices', 'tax_invoices'),
      ('gl', 'accounts', 'gl_accounts'),
      ('gl', 'account_map', 'gl_account_map'),
      ('gl', 'journals', 'gl_journals'),
      ('gl', 'failed_posts', 'gl_failed_posts'),
      ('payroll', 'runs', 'payroll_runs'),
      ('audit', 'logs', 'audit_logs')
    ) as v(mod, coll, rel)
  loop
    select count(*) into exp
    from public.ops_docs
    where module = rec.mod and collection = rec.coll and nullif(id, '') is not null;

    execute format('select count(*) from public.%I', rec.rel) into act;
    if exp is distinct from act then
      bad := bad || format('%s count expected %s actual %s; ', rec.rel, exp, act);
    end if;

    execute format(
      'select count(*) from public.ops_docs d where d.module = %L and d.collection = %L and nullif(d.id, '''') is not null and not exists (select 1 from public.%I t where t.id = d.id)',
      rec.mod, rec.coll, rec.rel
    ) into act;
    if act <> 0 then
      bad := bad || format('%s missing %s ids; ', rec.rel, act);
    end if;

    execute format(
      'select count(*) from public.%I t where not exists (select 1 from public.ops_docs d where d.module = %L and d.collection = %L and d.id = t.id)',
      rec.rel, rec.mod, rec.coll
    ) into act;
    if act <> 0 then
      bad := bad || format('%s extra %s rows; ', rec.rel, act);
    end if;
  end loop;

  for rec in
    select * from (values
      ('pembelian', 'purchases', 'payments', 'purchase_payments', 'purchase_id', 'purchases', 'amount', 'amount'),
      ('pembelian', 'returns', 'lines', 'purchase_return_lines', 'return_id', 'purchase_returns', 'qty', 'qty'),
      ('penjualan', 'orders', 'payments', 'sale_order_payments', 'order_id', 'sale_orders', 'amount', 'amount'),
      ('penjualan', 'returns', 'lines', 'sale_return_lines', 'return_id', 'sale_returns', 'qty', 'qty'),
      ('produksi', 'batches', 'outputs', 'batch_outputs', 'batch_id', 'production_batches', 'qty', 'qty'),
      ('produksi', 'pack_runs', 'lines', 'pack_run_lines', 'pack_run_id', 'pack_runs', 'qty', 'qty'),
      ('gl', 'journals', 'lines', 'gl_journal_lines', 'journal_id', 'gl_journals', 'debit', 'debit'),
      ('payroll', 'runs', 'lines', 'payroll_lines', 'run_id', 'payroll_runs', 'base', 'base')
    ) as v(mod, coll, arr, child, parent_col, parent_table, src_key, sum_col)
  loop
    execute format(
      'select coalesce(sum(jsonb_array_length(public.ops_copy_arr(doc, %L))), 0) from public.ops_docs where module = %L and collection = %L and nullif(id, '''') is not null',
      rec.arr, rec.mod, rec.coll
    ) into exp;
    execute format('select count(*) from public.%I', rec.child) into act;
    if exp is distinct from act then
      bad := bad || format('%s count expected %s actual %s; ', rec.child, exp, act);
    end if;

    execute format(
      'select count(*) from public.%I c where not exists (select 1 from public.%I p where p.id = c.%I)',
      rec.child, rec.parent_table, rec.parent_col
    ) into act;
    if act <> 0 then
      bad := bad || format('%s orphans %s; ', rec.child, act);
    end if;

    execute format(
      $q$
      select count(*) from (
        select public.ops_copy_child_id(d.id, t.elem, t.ord) as cid
        from public.ops_docs d
        cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, %L))
          with ordinality as t(elem, ord)
        where d.module = %L and d.collection = %L and nullif(d.id, '') is not null
      ) s
      where not exists (select 1 from public.%I c where c.id = s.cid)
      $q$,
      rec.arr, rec.mod, rec.coll, rec.child
    ) into act;
    if act <> 0 then
      bad := bad || format('%s missing child ids %s; ', rec.child, act);
    end if;

    execute format(
      'select coalesce(sum(public.ops_copy_num(elem->>%L, 0)), 0) from public.ops_docs d cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, %L)) elem where d.module = %L and d.collection = %L and nullif(d.id, '''') is not null',
      rec.src_key, rec.arr, rec.mod, rec.coll
    ) into expn;
    execute format('select coalesce(sum(%I), 0) from public.%I', rec.sum_col, rec.child) into actn;
    if expn is distinct from actn then
      bad := bad || format('%s sum %s expected %s actual %s; ', rec.child, rec.sum_col, expn, actn);
    end if;
  end loop;

  execute $q$
    select coalesce(sum(public.ops_copy_num(elem->>'credit', 0)), 0)
    from public.ops_docs d
    cross join lateral jsonb_array_elements(public.ops_copy_arr(d.doc, 'lines')) elem
    where d.module = 'gl' and d.collection = 'journals' and nullif(d.id, '') is not null
  $q$ into expn;
  select coalesce(sum(credit), 0) into actn from public.gl_journal_lines;
  if expn is distinct from actn then
    bad := bad || format('gl_journal_lines sum credit expected %s actual %s; ', expn, actn);
  end if;

  for rec in
    select * from (values
      ('pembelian', 'returns', 'purchase_returns'),
      ('penjualan', 'returns', 'sale_returns'),
      ('produksi', 'pack_runs', 'pack_runs'),
      ('period', 'unlock_requests', 'period_unlock_requests'),
      ('bank', 'sessions', 'bank_sessions'),
      ('tax', 'docs', 'tax_docs'),
      ('gl', 'journals', 'gl_journals'),
      ('gl', 'failed_posts', 'gl_failed_posts'),
      ('payroll', 'runs', 'payroll_runs')
    ) as v(mod, coll, rel)
  loop
    execute format(
      'select count(*) from public.ops_docs d join public.%I t on t.id = d.id where d.module = %L and d.collection = %L and t.created_at_label is distinct from coalesce(d.doc->>''createdAt'', '''')',
      rec.rel, rec.mod, rec.coll
    ) into act;
    if act <> 0 then
      bad := bad || format('%s created_at_label mismatch %s; ', rec.rel, act);
    end if;

    begin
      execute format(
        $q$
        select count(*) from public.ops_docs d
        join public.%I t on t.id = d.id
        where d.module = %L
          and d.collection = %L
          and coalesce(d.doc->>'createdAt', '') ~ '^\d{4}-\d{2}-\d{2}'
          and t.created_at = (d.doc->>'createdAt')::timestamptz
        $q$,
        rec.rel, rec.mod, rec.coll
      ) into act;
      if act <> 0 then
        bad := bad || format('%s created_at holds domain ISO (%s); ', rec.rel, act);
      end if;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        bad := bad || format('%s createdAt cast failed; ', rec.rel);
    end;
  end loop;

  select count(*) into act
  from public.purchases t
  join public.ops_docs d on d.module = 'pembelian' and d.collection = 'purchases' and d.id = t.id
  where t.date is distinct from coalesce(d.doc->>'date', '')
     or t.supplier_id is distinct from coalesce(d.doc->>'supplierId', '')
     or t.grain is distinct from coalesce(d.doc->>'grain', '')
     or t.sacks is distinct from public.ops_copy_num(d.doc->>'sacks', 0)
     or t.estimated_kg is distinct from public.ops_copy_num(d.doc->>'estimatedKg', 0)
     or t.price is distinct from public.ops_copy_num(d.doc->>'price', 0)
     or t.stage is distinct from coalesce(d.doc->>'stage', '')
     or t.weighing is distinct from public.ops_copy_json(d.doc, 'weighing')
     or t.tax is distinct from public.ops_copy_tax(d.doc);
  if act <> 0 then
    bad := bad || format('purchases scalar mismatch %s; ', act);
  end if;

  select count(*) into act
  from public.sale_orders t
  join public.ops_docs d on d.module = 'penjualan' and d.collection = 'orders' and d.id = t.id
  where t.customer_id is distinct from coalesce(d.doc->>'customerId', '')
     or t.sku is distinct from coalesce(d.doc->>'sku', '')
     or t.unit is distinct from coalesce(d.doc->>'unit', '')
     or t.qty is distinct from public.ops_copy_num(d.doc->>'qty', 0)
     or t.price is distinct from public.ops_copy_num(d.doc->>'price', 0)
     or t.delivery is distinct from public.ops_copy_json(d.doc, 'delivery')
     or t.tax is distinct from public.ops_copy_tax(d.doc);
  if act <> 0 then
    bad := bad || format('sale_orders scalar mismatch %s; ', act);
  end if;

  select count(*) into act
  from public.sale_returns t
  join public.ops_docs d on d.module = 'penjualan' and d.collection = 'returns' and d.id = t.id
  where t.tax is distinct from public.ops_copy_tax(d.doc)
     or t.created_at_label is distinct from coalesce(d.doc->>'createdAt', '');
  if act <> 0 then
    bad := bad || format('sale_returns scalar mismatch %s; ', act);
  end if;

  select count(*) into act
  from public.production_batches t
  join public.ops_docs d on d.module = 'produksi' and d.collection = 'batches' and d.id = t.id
  where t.input_sku is distinct from coalesce(d.doc->>'inputSku', '')
     or t.input_qty is distinct from public.ops_copy_num(d.doc->>'inputQty', 0)
     or t.stock_posted is distinct from public.ops_copy_bool(d.doc->>'stockPosted', false)
     or t.from_location is distinct from coalesce(d.doc->>'fromLocation', '')
     or t.target_rendemen is distinct from public.ops_copy_num(d.doc->>'targetRendemen', 0);
  if act <> 0 then
    bad := bad || format('production_batches scalar mismatch %s; ', act);
  end if;

  select count(*) into act
  from public.gl_accounts t
  join public.ops_docs d on d.module = 'gl' and d.collection = 'accounts' and d.id = t.id
  where t.code is distinct from coalesce(d.doc->>'code', '')
     or t.is_postable is distinct from public.ops_copy_bool(d.doc->>'isPostable', false)
     or t.active is distinct from public.ops_copy_bool(d.doc->>'active', false)
     or t.system is distinct from public.ops_copy_bool(d.doc->>'system', false);
  if act <> 0 then
    bad := bad || format('gl_accounts scalar mismatch %s; ', act);
  end if;

  select count(*) into act
  from public.gl_account_map t
  join public.ops_docs d on d.module = 'gl' and d.collection = 'account_map' and d.id = t.id
  where t.value is distinct from coalesce(public.ops_copy_json(d.doc, 'value'), '{}'::jsonb);
  if act <> 0 then
    bad := bad || format('gl_account_map value mismatch %s; ', act);
  end if;

  select count(*) into act
  from public.payroll_runs t
  join public.ops_docs d on d.module = 'payroll' and d.collection = 'runs' and d.id = t.id
  where t.period is distinct from coalesce(d.doc->>'period', '')
     or t.status is distinct from coalesce(d.doc->>'status', '')
     or t.created_at_label is distinct from coalesce(d.doc->>'createdAt', '')
     or t.approvals is distinct from public.ops_copy_json(d.doc, 'approvals');
  if act <> 0 then
    bad := bad || format('payroll_runs scalar mismatch %s; ', act);
  end if;

  if bad <> '' then
    raise exception 'ops copy verify failed: %', bad;
  end if;

  select n into exp from _ops_copy_src_count;
  raise notice 'ops copy verified; ops_docs rows=%', exp;
end
$chk$;

drop function public.ops_copy_child_id(text, jsonb, bigint);
drop function public.ops_copy_json(jsonb, text);
drop function public.ops_copy_arr(jsonb, text);
drop function public.ops_copy_tax(jsonb);
drop function public.ops_copy_bool(text, boolean);
drop function public.ops_copy_num(text, numeric);

commit;
