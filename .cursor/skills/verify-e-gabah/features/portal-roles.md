# Portal role gate

E-HR card appears only for admin and hr. Other roles still see E-Absensi.

## Sub-features

- `ehr-hidden` — pembelian/keuangan/etc. do not see E-HR on `/portal`
- `ehr-visible` — admin/hr see E-HR
- `hr-url-blocked` — non-HR hitting `/hr` redirects to `/portal`

## How to get to it (user POV)

1. Open `/login`, sign in, land on `/portal`.
2. Or open `/hr` directly after login.

## Driving it with browser

Preconditions: Vite up; doctor script `fail: 0`.

- Login as `beli@egabah.local` / `demo123` → `/portal` snapshot must not contain text `E-HR`.
- Login as `admin@egabah.local` / `demo123` → `/portal` snapshot contains `E-HR`.
- As `beli@`, navigate `/hr` → URL becomes `/portal` (or absensi fallback).

## Gotchas

- Portal app links open `target=_blank`; keep verification in the same tab via direct URL.
- Cached session: clear storage or use a fresh profile if role looks sticky.
