-- Persediaan cloud. Depends on 20261030_master_rbac (profiles, auth_is_admin, product_category).

do $$ begin
  create type public.movement_type as enum ('in', 'out', 'transfer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.correction_status as enum ('posted', 'void');
exception when duplicate_object then null;
end $$;

create table if not exists public.stock_balances (
  id text primary key,
  sku text not null,
  name text not null,
  category public.product_category not null default 'gabah',
  location text not null,
  unit text not null default 'kg',
  qty numeric not null default 0,
  min_qty numeric not null default 0,
  updated_at_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_balances_sku_location_uq unique (sku, location)
);

create table if not exists public.stock_movements (
  id text primary key,
  date_label text not null default '',
  reference text not null,
  type public.movement_type not null,
  sku text not null,
  product_name text not null,
  from_location text not null default '—',
  to_location text not null default '—',
  qty numeric not null default 0,
  unit text not null default 'kg',
  note text not null default '',
  actor text not null default '',
  receipt_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_corrections (
  id text primary key,
  date_label text not null default '',
  reference text not null,
  sku text not null,
  product_name text not null,
  location text not null,
  before_qty numeric not null default 0,
  after_qty numeric not null default 0,
  unit text not null default 'kg',
  reason text not null default '',
  status public.correction_status not null default 'posted',
  actor text not null default '',
  receipt_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_balances_sku_idx on public.stock_balances (sku);
create index if not exists stock_movements_sku_idx on public.stock_movements (sku);
create index if not exists stock_movements_reference_idx on public.stock_movements (reference);
create index if not exists stock_corrections_sku_idx on public.stock_corrections (sku);

create or replace function public.auth_is_stock_writer()
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
      and p.active = true
      and p.role in ('admin', 'gudang')
  );
$$;

alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_corrections enable row level security;

drop policy if exists stock_balances_select on public.stock_balances;
create policy stock_balances_select on public.stock_balances
  for select to authenticated
  using (true);

drop policy if exists stock_balances_write on public.stock_balances;
create policy stock_balances_write on public.stock_balances
  for all to authenticated
  using (public.auth_is_stock_writer())
  with check (public.auth_is_stock_writer());

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (true);

drop policy if exists stock_movements_write on public.stock_movements;
create policy stock_movements_write on public.stock_movements
  for all to authenticated
  using (public.auth_is_stock_writer())
  with check (public.auth_is_stock_writer());

drop policy if exists stock_corrections_select on public.stock_corrections;
create policy stock_corrections_select on public.stock_corrections
  for select to authenticated
  using (true);

drop policy if exists stock_corrections_write on public.stock_corrections;
create policy stock_corrections_write on public.stock_corrections
  for all to authenticated
  using (public.auth_is_stock_writer())
  with check (public.auth_is_stock_writer());
