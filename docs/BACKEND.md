# Backend / persistensi E-Gabah

Ops modul memakai **Supabase relational tables** bila `VITE_SUPABASE_*` diset; tanpa env → localStorage (dev saja). Produksi **wajib** set env Supabase (demo login ditolak di build `PROD`).

## Adapter

| Modul | Mode | File |
| --- | --- | --- |
| Master | Cloud `partners`/`products`/`profiles` atau local | `master-cloud.ts` / `master-storage.ts` |
| Persediaan | Cloud `stock_*` atau local | `persediaan-cloud.ts` / `persediaan-storage.ts` |
| Absensi | Cloud `attendance_records` atau local | `absensi-cloud.ts` / `absensi-storage.ts` |
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
8. `supabase/manual/20261105_99_ops_relational_drop_legacy.sql` — **manual setelah smoke**; drop `ops_docs` + `app_module_snapshots`

## Deploy checklist (Vercel)

### Env wajib di Vercel (Production + Preview)

| Key | Wajib | Sumber |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Ya | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Ya | Supabase → API → `anon` `public` key |
| `VITE_CLOUDINARY_CLOUD_NAME` | Ya jika upload bukti | Cloudinary dashboard |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Ya jika upload bukti | Unsigned upload preset |
| `VITE_CLOUDINARY_FOLDER` | Opsional | Default `egabah` |

**Jangan** masukkan ke Vercel: `DATABASE_URL`, `CLOUDINARY_API_SECRET`, service_role key, `CLOUDINARY_URL` / API key (server-only). Vite hanya mengekspos `VITE_*`.

Tanpa `VITE_SUPABASE_*` di production build, login ditolak (demo auth mati).

### Langkah

1. Set env di Vercel → Redeploy.
2. Apply migrasi 01→07 ke project Supabase target; **jangan** jalankan `supabase/manual/99_drop_legacy` sebelum verify.
3. Smoke: login admin → edit 1 dokumen ops → reload persist; kunci periode → mutasi ditolak; kotak masuk → Lihat detail + Buka modul `?dok=`.
4. Deploy frontend (`npm run build` / Vercel).
5. Baru jalankan `supabase/manual/20261105_99_ops_relational_drop_legacy.sql` setelah cutover OK.

Seed master: `docs/supabase-seed-master.md` + `supabase/seed/20261030_master_data.sql`.
