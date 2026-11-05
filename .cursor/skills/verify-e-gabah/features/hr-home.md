# E-HR beranda

Stats, side-by-side charts, and a work-queue table with filter/sort.

## Sub-features

- `charts-split` — kehadiran + ringkasan cuti in `lg:grid-cols-2`
- `queue-table` — cuti pending, payroll waiting, late today
- `no-pintasan` — no shortcut button strip
- `payroll-plain` — `/hr/payroll` description without arrow workflow text

## How to get to it (user POV)

Login as `hr@` or `admin@`, open `/hr`.

## Driving it with browser

- Snapshot `/hr`: texts `Pola kehadiran`, `Ringkasan pengajuan`, `Pengajuan & tindak lanjut`.
- Filter dropdown on queue: Jenis / Urutkan.
- Nav has no `Persetujuan gaji`; `/hr/payroll/persetujuan` redirects to `/hr/payroll`.

## Gotchas

- Empty queue is valid when no pending leave/payroll/late rows.
- Admin queue shows `menunggu_admin` only; HR queue shows `menunggu_hr` only.
