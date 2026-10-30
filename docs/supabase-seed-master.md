# Seed Supabase — Master + Auth (DB-A)

## 1. Migrasi schema

SQL Editor → jalankan `supabase/migrations/20261030_master_rbac.sql`.

## 2. Auth users

Authentication → Users → Add user (matikan email confirm untuk email lokal):

| Email | Password | profile.role |
| --- | --- | --- |
| admin@egabah.local | demo123 | admin |
| beli@egabah.local | demo123 | pembelian |
| produksi@egabah.local | demo123 | produksi |
| gudang@egabah.local | demo123 | gudang |
| jual@egabah.local | demo123 | penjualan |
| kas@egabah.local | demo123 | keuangan |

Salin UUID tiap user setelah dibuat.

## 3. Profiles

Ganti `UUID_*` dengan UUID nyata:

```sql
insert into public.profiles (id, email, name, role, title, phone, branch, department, active)
values
  ('UUID_ADMIN', 'admin@egabah.local', 'Admin E-Gabah', 'admin', 'Pemilik', '0812-0000-0001', 'Kantor Pusat', 'Manajemen', true),
  ('UUID_BELI', 'beli@egabah.local', 'Petugas Pembelian', 'pembelian', '', '0812-0000-0002', '', 'Pembelian', true),
  ('UUID_PRODUKSI', 'produksi@egabah.local', 'Operator Produksi', 'produksi', '', '0812-0000-0003', '', 'Produksi', true),
  ('UUID_GUDANG', 'gudang@egabah.local', 'Petugas Gudang', 'gudang', '', '0812-0000-0004', '', 'Gudang', true),
  ('UUID_JUAL', 'jual@egabah.local', 'Petugas Penjualan', 'penjualan', '', '0812-0000-0005', '', 'Penjualan', true),
  ('UUID_KAS', 'kas@egabah.local', 'Petugas Keuangan', 'keuangan', '', '0812-0000-0006', '', 'Keuangan', true)
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();
```

## 4. Partners + products

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
