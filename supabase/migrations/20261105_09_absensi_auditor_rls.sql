-- Allow keuangan (payroll / SDM proxy) to read all attendance for audit.
-- Admin remains the only role that can delete.

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
      and p.role in ('admin', 'keuangan')
  );
$$;

drop policy if exists attendance_select on public.attendance_records;
create policy attendance_select on public.attendance_records
  for select to authenticated
  using (
    public.auth_can_audit_absensi()
    or user_id = auth.uid()
  );
