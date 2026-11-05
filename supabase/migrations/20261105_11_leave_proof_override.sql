-- Bukti wajib pada pengajuan cuti/izin + metadata override admin.
-- Depends on: 20261105_10_hr_leave_payroll (leave_requests).

alter table public.leave_requests
  add column if not exists proof jsonb;

alter table public.leave_requests
  add column if not exists overridden_by text not null default '';

alter table public.leave_requests
  add column if not exists overridden_at timestamptz;

alter table public.leave_requests
  add column if not exists override_note text not null default '';

comment on column public.leave_requests.proof is
  'Bukti lampiran (nama/mime/url) — wajib di aplikasi untuk setiap pengajuan';
comment on column public.leave_requests.override_note is
  'Alasan override admin terhadap keputusan HR';
