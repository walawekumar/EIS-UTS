# Design: E-HR, cuti, absensi cloud, payroll 3-approve

## Goals

- Fix absensi cloud (`attendance_records` missing → PGRST205).
- Portal sibling **E-HR** (`/hr`) beside E-Absensi; not nested in E-Gabah.
- Employee leave submit in E-Absensi; HR/admin approve in E-HR.
- Payroll sequential approve: HR → Admin → Keuangan → cair.

## Decisions

- Admin is one role across apps; `hr` is SDM specialist.
- Leave approve: admin|hr only (not keuangan).
- Payroll stamps cannot be forged across roles (admin cannot stamp as HR).
- Stamp attendance Sen–Jum on leave approve (`izin`/`sakit`).

## Migrations

`08` absensi → `09` auditor → `10` hr + leave_requests + auditor admin|hr + payroll write hr.
