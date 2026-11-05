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

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.auth_is_admin());

drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

drop policy if exists partners_select on public.partners;
create policy partners_select on public.partners
  for select to authenticated
  using (true);

drop policy if exists partners_write on public.partners;
create policy partners_write on public.partners
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (true);

drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
