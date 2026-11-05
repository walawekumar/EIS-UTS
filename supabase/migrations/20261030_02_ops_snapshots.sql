-- Ops module snapshots (JSONB). Depends on profiles + auth_is_admin.

create table if not exists public.app_module_snapshots (
  module_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.auth_can_write_module(p_key text)
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
      and (
        p.role = 'admin'
        or (p_key = 'pembelian' and p.role in ('pembelian', 'gudang', 'keuangan'))
        or (p_key = 'penjualan' and p.role in ('penjualan', 'keuangan'))
        or (p_key = 'produksi' and p.role = 'produksi')
        or (p_key in ('keuangan', 'period', 'bank', 'tax', 'gl') and p.role = 'keuangan')
        or (p_key = 'payroll' and p.role = 'keuangan')
        or (p_key = 'audit' and p.role in ('admin', 'keuangan'))
      )
  );
$$;

alter table public.app_module_snapshots enable row level security;

drop policy if exists app_module_snapshots_select on public.app_module_snapshots;
create policy app_module_snapshots_select on public.app_module_snapshots
  for select to authenticated
  using (true);

drop policy if exists app_module_snapshots_insert on public.app_module_snapshots;
create policy app_module_snapshots_insert on public.app_module_snapshots
  for insert to authenticated
  with check (public.auth_can_write_module(module_key));

drop policy if exists app_module_snapshots_update on public.app_module_snapshots;
create policy app_module_snapshots_update on public.app_module_snapshots
  for update to authenticated
  using (public.auth_can_write_module(module_key))
  with check (public.auth_can_write_module(module_key));

drop policy if exists app_module_snapshots_delete on public.app_module_snapshots;
create policy app_module_snapshots_delete on public.app_module_snapshots
  for delete to authenticated
  using (public.auth_can_write_module(module_key));
