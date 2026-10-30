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

## Arah Supabase

1. Tambah `@supabase/supabase-js` + env `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. Ganti body `load` / `save` di tiap `*Repository` (atau buat `supabaseRepository` dengan interface yang sama).
3. Auth: ganti `demo-users.ts` + `AuthContext.login` dengan `supabase.auth.signInWithPassword`.
4. Idealnya ganti dump penuh jadi `select` / `upsert` per tabel + realtime (ganti `publishSync` / `subscribeSync`).

Integrasi antar modul (utang, piutang, kas, stok, produksi) sudah terjadi di context React; backend hanya perlu menyimpan hasil transaksi yang sama.
