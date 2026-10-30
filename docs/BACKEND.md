# Backend / persistensi E-Gabah

Saat ini data operasional disimpan di **localStorage** lewat adapter repository. UI dan store React tidak bergantung langsung pada API.

## Adapter lokal

| Modul | Key | File |
| --- | --- | --- |
| Persediaan | `egabah.persediaan.v1` | `src/features/persediaan/persediaan-storage.ts` |
| Pembelian | `egabah.pembelian.v1` | `src/features/pembelian/pembelian-storage.ts` |
| Penjualan | `egabah.penjualan.v1` | `src/features/penjualan/penjualan-storage.ts` |
| Produksi | `egabah.produksi.v1` | `src/features/produksi/produksi-storage.ts` |
| Keuangan | `egabah.keuangan.v1` | `src/features/keuangan/keuangan-storage.ts` |
| Master Data | `egabah.master.v1` | `src/features/master/master-storage.ts` |
| Audit | `egabah.audit.v1` | `src/features/audit/audit-storage.ts` |
| Payroll | `egabah.payroll.v1` | `src/features/payroll/payroll-storage.ts` |
| Settings | `egabah.settings.v2` | `src/features/settings/app-settings.ts` |
| Auth | `egabah.auth.user` / session | `src/lib/auth-storage.ts` |

Factory generik: `src/lib/create-local-repository.ts`.  
Domain & status: `docs/DOMAIN.md`.  
Sync multi-tab (pra-cloud): `src/features/sync/sync-bus.ts`.

## Supabase DB-A (Master + Auth)

- Env: lihat `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Migrasi: `supabase/migrations/20261030_master_rbac.sql`
- Seed: `docs/supabase-seed-master.md` + `supabase/seed/20261030_master_data.sql`
- Client: `src/lib/supabase-client.ts`
- Cloud master: `src/features/master/master-cloud.ts`
- Auth: `AuthContext` memakai Supabase bila env ada; else `demo-users`

Modul lain (persediaan, ops, keuangan, …) masih localStorage.

## Arah berikutnya

1. Ganti body `load` / `save` modul operasional ke tabel Supabase + RLS.
2. Idealnya `select` / `upsert` per tabel + realtime (ganti `publishSync` / `subscribeSync`).

Integrasi antar modul (utang, piutang, kas, stok, produksi) sudah terjadi di context React; backend hanya perlu menyimpan hasil transaksi yang sama.
