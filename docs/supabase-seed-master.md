# Seed Supabase — Master + Auth (DB-A)

## 1. Migrasi schema

SQL Editor → jalankan `supabase/migrations/20261030_01_master_rbac.sql`.

## 2. Auth users + profiles (otomatis)

Jalankan `supabase/seed/20261030_auth_profiles.sql` (buat `auth.users` + `auth.identities` + `public.profiles`).

Password semua: `demo123`

| Email | role |
| --- | --- |
| admin@egabah.local | admin |
| beli@egabah.local | pembelian |
| produksi@egabah.local | produksi |
| gudang@egabah.local | gudang |
| jual@egabah.local | penjualan |
| kas@egabah.local | keuangan |

## 3. Partners + products

Jalankan `supabase/seed/20261030_master_data.sql`.

Regenerate dari seed app:

```bash
npx tsx --tsconfig tsconfig.app.json scripts/gen-master-seed.ts
```

## 5. Verifikasi

```sql
select email, role, active from public.profiles order by email;
select count(*) from public.partners;
select count(*) from public.products;
```

## 6. Env app

`.env.local` harus berisi `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, lalu restart `npm run dev`.
