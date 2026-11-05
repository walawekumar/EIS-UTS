-- Absensi / kehadiran. Depends on 20261030_01_master_rbac (profiles).

do $$ begin
  create type public.attendance_status as enum (
    'hadir',
    'terlambat',
    'izin',
    'sakit',
    'alpha'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.attendance_records (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_name text not null default '',
  work_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status public.attendance_status not null default 'hadir',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_user_date_uq unique (user_id, work_date)
);

create index if not exists attendance_records_work_date_idx
  on public.attendance_records (work_date desc);
create index if not exists attendance_records_user_id_idx
  on public.attendance_records (user_id);

alter table public.attendance_records enable row level security;

create or replace function public.auth_is_absensi_reader()
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
  );
$$;

create or replace function public.auth_is_absensi_admin()
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
      and p.role = 'admin'
  );
$$;

drop policy if exists attendance_select on public.attendance_records;
create policy attendance_select on public.attendance_records
  for select to authenticated
  using (
    public.auth_is_absensi_admin()
    or user_id = auth.uid()
  );

drop policy if exists attendance_insert on public.attendance_records;
create policy attendance_insert on public.attendance_records
  for insert to authenticated
  with check (
    public.auth_is_absensi_admin()
    or user_id = auth.uid()
  );

drop policy if exists attendance_update on public.attendance_records;
create policy attendance_update on public.attendance_records
  for update to authenticated
  using (
    public.auth_is_absensi_admin()
    or user_id = auth.uid()
  )
  with check (
    public.auth_is_absensi_admin()
    or user_id = auth.uid()
  );

drop policy if exists attendance_delete on public.attendance_records;
create policy attendance_delete on public.attendance_records
  for delete to authenticated
  using (public.auth_is_absensi_admin());
