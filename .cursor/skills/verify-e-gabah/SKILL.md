---
name: verify-e-gabah
description: >-
  Drive and prove E-Gabah / E-Absensi / E-HR behavior in this repo. Use when
  verifying portal access, absensi geo, cuti, or HR payroll UI after changes.
---

# Verify E-Gabah (portal + absensi + HR)

## Launch

```bash
npx vite --host 127.0.0.1 --port 5173
```

Ready when log shows `Local: http://127.0.0.1:5173/`. Teardown: kill only the PID you started.

Demo passwords: `demo123`. Accounts in `src/features/auth/demo-users.ts` (`admin@`, `hr@`, `beli@`, `kas@`, …).

## Doctor

```bash
node scripts/verify-hr-absensi-checklist.mjs
```

Expect `fail: 0`. Evidence writes to `.audit/hr-absensi-checklist.json`.

Also: `npm run build` must exit 0.

## Drive (browser)

Prefer ARIA snapshot over coordinates. Paths:

| Feature | URL | Login |
| --- | --- | --- |
| Portal role gate | `/portal` | `beli@` then `admin@` |
| Absensi + geo | `/absensi` | any employee |
| Cuti modal | `/absensi/cuti` | any employee |
| HR home / queue | `/hr` | `admin@` or `hr@` |
| Payroll | `/hr/payroll` | `hr@` |

## Evidence

- Checklist JSON: `.audit/hr-absensi-checklist.json`
- Decision trail (optional): `.audit/hr-absensi-verify.tsv`
- Browser: ARIA snapshot + screenshot of portal cards / HR table / lokasi cell

## Cleanup

Stop only the Vite PID from Launch. Keep `.audit/*` proof files.

## Feature map

See `features/` in this skill folder.
