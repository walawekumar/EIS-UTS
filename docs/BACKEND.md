# Backend / persistensi E-Gabah

Ops modul memakai **Supabase relational tables** bila `VITE_SUPABASE_*` diset; tanpa env → localStorage (dev saja). Produksi **wajib** set env Supabase (demo login ditolak di build `PROD`).

## Adapter

| Modul | Mode | File |
| --- | --- | --- |
| Master | Cloud `partners`/`products`/`profiles` atau local | `master-cloud.ts` / `master-storage.ts` |
| Persediaan | Cloud `stock_*` atau local | `persediaan-cloud.ts` / `persediaan-storage.ts` |
| Absensi | Cloud `attendance_records` atau local | `absensi-cloud.ts` / `absensi-storage.ts` |
| Cuti / leave | Cloud `leave_requests` atau local | `leave-cloud.ts` / `leave-storage.ts` |
| Ops (PO/SO/batch/kas/GL/tax/bank/period/payroll/audit) | Relational via `createRelationalBackedRepository` | `src/lib/cloud-relational.ts`, `ops-relational/mappers/*` |
| Settings / theme | Local only | `app-settings.ts` |

Hydrate gate: `OpsCloudGate` (fail-closed jika tabel gagal dimuat).

## Migrasi (urutan lexical)

1. `20261030_01_master_rbac.sql`
2. `20261030_02_ops_snapshots.sql` — `auth_can_write_module`
3. `20261030_03_persediaan.sql`
4. `20261030_04_ops_docs.sql` + `05_ops_docs_finance.sql` (staging copy)
5. `20261030_06_ops_relational.sql`
6. `20261105_07_period_unlock_role_rls.sql` — RPC unlock + trigger block `active→false`; no client UPDATE on unlock requests
7. `20261105_08_absensi.sql` — `attendance_records` + RLS
8. `20261105_09_absensi_auditor_rls.sql` — auditor absensi (diganti di 10)
9. `20261105_10_hr_leave_payroll.sql` — role `hr`, `leave_requests`, auditor admin|hr, payroll write hr
10. `20261105_11_leave_proof_override.sql` — bukti lampiran + override admin pada leave
11. `20261105_12_attendance_geo.sql` — lat/lng check-in & check-out
12. `supabase/manual/20261105_99_ops_relational_drop_legacy.sql` — **manual setelah smoke**; drop `ops_docs` + `app_module_snapshots`

## Deploy checklist (Vercel)

### Env wajib di Vercel (Production + Preview)

Tambahkan di **Project → Settings → Environment Variables** (centang Production & Preview):

| Key | Wajib | Contoh / sumber |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | **Ya** | `https://xxxx.supabase.co` (Supabase → Settings → API → Project URL) |
| `VITE_SUPABASE_ANON_KEY` | **Ya** | anon `public` key (Settings → API) |
| `VITE_CLOUDINARY_CLOUD_NAME` | **Ya** (upload bukti) | Cloudinary dashboard → Cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | **Ya** (upload bukti) | Unsigned upload preset |
| `VITE_CLOUDINARY_FOLDER` | Opsional | Default `egabah` |

Setelah mengubah env → **Redeploy** (Vite bake env saat build).

**Jangan** masukkan ke Vercel: `DATABASE_URL`, `CLOUDINARY_API_SECRET`, `service_role` key, `CLOUDINARY_URL` / API key (server-only). Hanya `VITE_*`.

Tanpa `VITE_SUPABASE_*` di production build, login ditolak (demo auth mati).

### Langkah

1. Set env di Vercel → Redeploy (`vercel.json` SPA rewrite sudah ada).
2. Apply migrasi 01→12 ke project Supabase target; **jangan** jalankan `supabase/manual/99_drop_legacy` sebelum verify.
3. Smoke: login → **Portal** → E-Gabah / E-Absensi / E-HR; check-in cloud; ajukan cuti; payroll HR→admin→keuangan→cair.
4. Deploy frontend (`npm run build` / Vercel).
5. Baru jalankan `supabase/manual/20261105_99_ops_relational_drop_legacy.sql` setelah cutover OK.

Seed master: `docs/supabase-seed-master.md` + `supabase/seed/20261030_master_data.sql`.
