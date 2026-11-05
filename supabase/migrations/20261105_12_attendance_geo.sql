-- Geolocation check-in / check-out pada attendance_records.
-- Depends on: 20261105_08_absensi.

alter table public.attendance_records
  add column if not exists check_in_lat double precision;

alter table public.attendance_records
  add column if not exists check_in_lng double precision;

alter table public.attendance_records
  add column if not exists check_in_accuracy double precision;

alter table public.attendance_records
  add column if not exists check_out_lat double precision;

alter table public.attendance_records
  add column if not exists check_out_lng double precision;

alter table public.attendance_records
  add column if not exists check_out_accuracy double precision;

comment on column public.attendance_records.check_in_lat is
  'Latitude WGS84 saat check-in (browser geolocation)';
comment on column public.attendance_records.check_in_lng is
  'Longitude WGS84 saat check-in';
