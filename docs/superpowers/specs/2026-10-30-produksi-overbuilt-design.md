# Spek: Produksi + fondasi overbuilt (pra-backend)

## Tujuan

Mengganti placeholder Produksi dengan halaman nyata (Batch, Input–Output, Rendemen), plus fondasi multi-gudang, multi-approve, audit, void, dan syncBus lokal.

## Halaman

1. `/app/produksi` — daftar batch, status, buat/submit/approve/proses/selesai/void
2. `/app/produksi/input-output` — detail massa input/output + selisih per batch
3. `/app/produksi/rendemen` — target vs aktual, ranking batch

## Out of scope gelombang 1

Realtime antar perangkat, RLS, void pembelian/penjualan penuh (dicatat di DOMAIN.md sebagai fase berikutnya).
