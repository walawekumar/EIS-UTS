# Spek: Operasional gabah — retur, QC, packing, costing (gelombang 1)

Tanggal: 2026-10-30  
Status: approved (user: acc)  
Pra-syarat: gelombang 0 (produksi/penjualan/master/audit) sudah di `main` — verifikasi saja sebelum coding

## Tujuan

Menutup celah operasional E-Gabah yang masih tipis: retur beli/jual, QC per lot, grading/bagging setelah giling, dan costing/rendemen per lot — masih pra-backend (localStorage), tanpa jurnal akuntansi (itu gelombang 2).

## Roadmap disepakati

| Gelombang | Isi | Status |
| --- | --- | --- |
| 0 | Commit/land WIP (produksi, penjualan, master, audit, sync, laporan, settings, backup) | Done di `main` (verifikasi di plan) |
| **1 (spek ini)** | Retur + QC lot + packing/grading + costing per lot | Desain |
| 2 | Akuntansi penuh: COA editable, jurnal otomatis + manual, rekonsiliasi bank, tutup buku, PPN 11%/0%, e-Faktur mock (nomor + CSV) | Spek terpisah setelah 1 stabil |
| 3 | Operasional berat: jembatan timbang/gate simulasi, drying/parboil, custom milling, multi-cabang | Nanti |
| DB | Persistensi cloud (Supabase/dll) | Setelah fitur di atas |

## Pendekatan

Perluas context/storage yang ada (bukan modul ERP terpisah). Dokumen retur & pack punya stage machine ringan; QC menempel ke `lotId`; costing adalah snapshot terhitung. UI: `OpsChrome` / drawer + `ConfirmDialog`.

## Gelombang 0 — land WIP

Working tree sudah berisi implementasi wired (`tsc` hijau) yang belum di-commit. Sebelum gelombang 1:

1. Review singkat tidak ada secret di WIP
2. Commit terstruktur (atau satu commit “feat: land produksi/penjualan/master/audit foundation”) ke `main` / branch feature lalu merge
3. Update `docs/DOMAIN.md` / `docs/BACKEND.md` jika belum sinkron dengan yang diland

Tanpa langkah ini, gelombang 1 menumpuk di atas fondasi tidak terlacak git.

## Entitas & alur

### Retur pembelian — `PurchaseReturn`

Storage: perluas payload `egabah.pembelian.v1` dengan array `returns` (satu dump modul, migrasi `migratePurchaseBundle` menambah `returns: []` bila absen).

```
draft → diajukan → disetujui → posted
                 ↘ ditolak (edit → draft → ajukan ulang)
```

| Field inti | Keterangan |
| --- | --- |
| `id`, `purchaseId`, `lotId?` | Soft-link ke PO |
| `lines[]` | `{ sku, qty }` — qty ≤ sisa setelah retur posted sebelumnya |
| `reason`, `stage`, `approvals?`, `postedAt?` | |

**Post `posted`:** mutasi stok `out` (kembali ke pemasok), kurangi outstanding AP (atau catatan kredit jika sudah dibayar sebagian). Audit `void`/`return`. Tidak hard-delete PO asal.

**Peran:** ajukan = pembelian\|admin; approve/post = keuangan\|admin.

### Retur penjualan — `SaleReturn`

Serupa; link `orderId`. Storage: array `returns` di `egabah.penjualan.v1`. Post: stok `in`, kurangi AR / kredit nota. Ajukan = penjualan\|admin; approve/post = keuangan\|admin.

### QC lot — `LotQc`

Key = `lotId` dari timbang pembelian. Satu record aktif per lot (upsert). Storage: map/array `lotQc` di `egabah.pembelian.v1` (lot lahir dari timbang PO).

| Field | Keterangan |
| --- | --- |
| moisture, impurity, brokenPct | Angka % |
| grade | `A` \| `B` \| `C` \| `reject` |
| passed | boolean |
| note, by, at | Actor + ISO |
| overrideReason? | Wajib jika terima barang saat `!passed` |

**Gate penerimaan:** konfirmasi terima PO membutuhkan QC `passed` **atau** override admin + alasan (audit). Produksi menampilkan ringkas QC saat pilih/input lot gabah.

**Peran isi QC:** pembelian\|gudang\|admin. Override: admin saja.

### Packing / grading — `PackRun`

Dari batch produksi `done`: pecah satu output line menjadi N baris kemasan/grade. Storage: array `packRuns` di `egabah.produksi.v1`.

```
draft → posted  (edit material = void pack + buat baru)
```

| Field | Keterangan |
| --- | --- |
| `batchId`, `sourceSku` | Output giling sumber |
| `lines[]` | `{ sku, grade?, qty, bags?, location }` |
| `postedAt?`, `voidedAt?` | |

**Post:** stok `out` dari SKU output giling; `in` ke SKU kemasan/grade. Tolak jika stok sumber kurang. Peran: produksi\|admin.

### Costing lot — `LotCost` (snapshot)

Storage: array `lotCosts` di `egabah.produksi.v1`; sumber nilai gabah dibaca dari pembelian saat hitung. Bukan workflow approve. Dihitung/disimpan saat batch selesai atau saat user “hitung ulang” di laporan.

```
costPerKgBeras = (nilaiGabahEfektifLot + alokasiBiayaOps) / qtyBerasHasil
```

- Nilai gabah: dari PO terkait lot (netto × harga efektif setelah rafaksi).
- Alokasi biaya: manual (input) atau proporsi qty batch dalam periode terhadap total biaya `posted` di periode yang sama (aturan dipilih di UI, disimpan di snapshot).
- Snapshot tidak berubah saat master harga berubah.
- Tampil di Rendemen (ranking) + Laporan.

## UI / nav

| Modul | Perubahan |
| --- | --- |
| Pembelian | Sub-route `/app/pembelian/retur` + daftar QC `/app/pembelian/qc`; QC juga bisa diisi dari drawer penerimaan |
| Penjualan | Sub-route `/app/penjualan/retur`; aksi retur juga dari order `dikirim` |
| Produksi | Packing (grading/bagging); kolom costing di Rendemen / detail batch |
| Laporan | Blok costing & rendemen per lot |
| Nav | Item role-gated sesuai bagian Peran di atas |

Responsive: ikut shell (drawer sidebar, filter stack, tabel `overflow-x-auto`, drawer full-width mobile). Dialog: `ConfirmDialog` / `PromptDialog` saja.

## Error & guard

- Qty retur / pack berlebih → error string, tidak partial post
- Retur/pack/override QC → konfirmasi custom + audit
- Hard-delete hanya dokumen `draft` / `ditolak`
- Migrasi storage: baca lama aman; field baru opsional dengan default

## Out of scope (gelombang 1)

- COA, jurnal, PPN, e-Faktur, rekonsiliasi bank, tutup buku
- Hardware jembatan timbang, drying/parboil, custom milling, multi-cabang
- Backend/DB cloud, Vitest baru (kecuali sudah ada di repo)
- Void “penuh” di luar retur bertahap di atas (sudah ada void PO/SO di fondasi — retur adalah jalur parsial)

## Verifikasi

1. `npx tsc --noEmit`
2. Manual: retur beli/jual membalik stok + AP/AR
3. QC blokir terima; override admin teraudit
4. Pack memindahkan stok ke SKU kemasan
5. Costing muncul di ranking lot / laporan
6. Tidak ada `window.confirm` / `prompt` native di alur baru

## Handoff gelombang 2 (bukan bagian spek ini)

Setelah gelombang 1 stabil, spek terpisah: COA editable, jurnal otomatis dari transaksi (termasuk retur & pack), jurnal manual, rekonsiliasi bank, tutup periode, PPN 11%/0%, e-Faktur mock (nomor + export CSV gaya DJP). Gelombang 1 **tidak** menulis jurnal.
