# Spek: Normalisasi ops docs (pembelian / penjualan / produksi)

Tanggal: 2026-10-30  
Status: superseded

Spek ini digantikan oleh `docs/superpowers/specs/2026-10-30-ops-relational-normalize-design.md`. Penyimpanan `ops_docs` (satu baris JSONB per dokumen) dan singleton `app_module_snapshots` sudah di-drop; data operasional sepuluh modul hidup di tabel relasional bertipe. Kode runtime `cloud-ops-docs`, `ops-docs-backed-repository`, `cloud-snapshot`, dan `cloud-backed-repository` dihapus karena tidak ada pemanggil lagi.

## Inventaris pra-normalisasi

| Modul app | Di Supabase? | Bentuk |
| --- | --- | --- |
| Auth/Master | ya | `profiles`, `partners`, `products` |
| Persediaan | ya | `stock_*` |
| pembelian…audit (10) | ya | `app_module_snapshots` JSONB singleton |
| Hardening | branch lokal | belum merge |

## Keputusan gelombang ini

- Normalisasi **pembelian, penjualan, produksi** dulu (rantai operasional).
- Bentuk: tabel `ops_docs` — **1 baris = 1 dokumen** (`module`, `collection`, `id`, `doc jsonb`).
- Keuangan family + payroll + audit tetap snapshot sementara.
- UI/Context tidak berubah; ganti repository + hydrate di `OpsCloudGate`.
- Migrasi isi dari `app_module_snapshots` → `ops_docs`, lalu hapus key snapshot ketiga modul.
