-- Role hr + leave_requests + absensi auditor hr + payroll write for hr.
-- Depends on: 20261030_01_master_rbac, 20261105_08_absensi, 20261105_09_absensi_auditor_rls.

do $$ begin
  alter type public.user_role add value if not exists 'hr';
exception
  when duplicate_object then null;
end $$;

-- Auditor absensi: admin | hr (bukan keuangan)
create or replace function public.auth_can_audit_absensi()
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
      and p.role in ('admin', 'hr')
  );
$$;

-- HR/admin boleh upsert attendance orang lain (stamp cuti)
drop policy if exists attendance_insert on public.attendance_records;
create policy attendance_insert on public.attendance_records
  for insert to authenticated
  with check (
    public.auth_can_audit_absensi()
    or user_id = auth.uid()
  );

drop policy if exists attendance_update on public.attendance_records;
create policy attendance_update on public.attendance_records
  for update to authenticated
  using (
    public.auth_can_audit_absensi()
    or user_id = auth.uid()
  )
  with check (
    public.auth_can_audit_absensi()
    or user_id = auth.uid()
  );

-- Payroll write: admin | keuangan | hr
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
        or (p_key = 'payroll' and p.role in ('keuangan', 'hr'))
        or (p_key = 'audit' and p.role in ('admin', 'keuangan', 'hr'))
      )
  );
$$;

do $$ begin
  create type public.leave_type as enum ('cuti', 'izin', 'sakit', 'dinas');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.leave_requests (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_name text not null default '',
  leave_type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  days numeric(6,1) not null default 1,
  reason text not null default '',
  status public.leave_status not null default 'pending',
  reviewed_by text not null default '',
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_dates_chk check (end_date >= start_date)
);

create index if not exists leave_requests_user_id_idx
  on public.leave_requests (user_id);
create index if not exists leave_requests_status_idx
  on public.leave_requests (status);
create index if not exists leave_requests_start_date_idx
  on public.leave_requests (start_date desc);

alter table public.leave_requests enable row level security;

create or replace function public.auth_is_hr_or_admin()
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
      and p.role in ('admin', 'hr')
  );
$$;

drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests
  for select to authenticated
  using (
    public.auth_is_hr_or_admin()
    or user_id = auth.uid()
  );

drop policy if exists leave_insert on public.leave_requests;
create policy leave_insert on public.leave_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists leave_update on public.leave_requests;
create policy leave_update on public.leave_requests
  for update to authenticated
  using (
    public.auth_is_hr_or_admin()
    or (user_id = auth.uid() and status = 'pending')
  )
  with check (
    public.auth_is_hr_or_admin()
    or (user_id = auth.uid() and status in ('pending', 'cancelled'))
  );

drop policy if exists leave_delete on public.leave_requests;
create policy leave_delete on public.leave_requests
  for delete to authenticated
  using (public.auth_is_hr_or_admin());
