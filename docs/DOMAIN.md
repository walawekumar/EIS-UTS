# Domain E-Gabah (pra-backend)

Sumber kebenaran tipe: `src/features/*/ *-data.ts`. Dokumen ini merangkum entitas, status, dan efek silang modul.

## Entitas inti

| Entitas | Modul | Key storage |
| --- | --- | --- |
| Partner (pemasok/pelanggan) | Master | `egabah.master.v1` |
| Produk / SKU | Master | ↑ |
| Pengguna & peran | Master | ↑ |
| Purchase / PurchaseReturn / LotQc | Pembelian | `egabah.pembelian.v1` |
| SaleOrder / SaleReturn | Penjualan | `egabah.penjualan.v1` |
| Stock / Movement / Correction | Persediaan | `egabah.persediaan.v1` |
| Batch (giling) / PackRun / LotCost | Produksi | `egabah.produksi.v1` |
| Cash / Payable / Receivable / Expense | Keuangan | `egabah.keuangan.v1` |
| AuditLog | Sistem | `egabah.audit.v1` |

## Lokasi (multi-gudang MVP)

Nilai string di field `location` / `fromLocation` / `toLocation` (siap diganti `locationId` di cloud):

- `Silo 1`, `Gudang A`, `Gudang B`, `Lantai Produksi`

Alur produksi tipikal: **Silo/Gudang → Lantai Produksi (proses) → Gudang output**.

## Status dokumen

### Produksi — `BatchStage`

`draft` → `submitted` → `approved` → `processing` → `done`  
Alternatif: `rejected` (kembali ke draft), `void` (setelah posted/done, dengan reverse stok).

| Aksi | Peran | Efek stok |
| --- | --- | --- |
| Buat batch | produksi, admin | — |
| Submit / approve / reject | admin (approve), produksi (submit) | — |
| Mulai proses | produksi, admin | — |
| Selesaikan (post) | produksi, admin | Gabah **out** dari lokasi input; output **in** ke lokasi hasil |
| Void | admin | Reverse gerakan batch |

### Persediaan — koreksi

`posted` \| `void` (void mengembalikan qty ke `beforeQty`).

### Keuangan — biaya

`draft` \| `posted` \| `void`.

### Pembelian — `PurchaseStage`

Migrasi lokal: `dicatat` → `diajukan`, `diterima` → `selesai` (`migratePurchaseStage`).

```
draft → diajukan → disetujui → ditimbang → menunggu_selesai → selesai
                 ↘ ditolak (edit → draft → ajukan ulang)
void: dari ditimbang | menunggu_selesai | selesai (keuangan|admin + alasan)
```

| Aksi | Peran | Gate / bukti |
| --- | --- | --- |
| Buat / edit | pembelian, admin | `draft` / `ditolak` |
| Ajukan ke keuangan | pembelian, admin | wajib `invoiceProof` |
| Approve / tolak anggaran | keuangan, admin | stage `diajukan`; lihat invoice di drawer |
| Timbang | pembelian, admin | hanya setelah `disetujui`; bukti `weighing.receiptName` |
| Terima barang | pembelian, admin | stok in + AP; wajib `purchaseProof` → `menunggu_selesai` |
| Selesai | keuangan, admin | wajib `purchaseProof`; kunci dokumen |
| Bayar utang (AP) | keuangan, admin | wajib `transferProof` per pembayaran |
| Void | keuangan, admin | reverse stok + hapus AP tertaut |

Approve anggaran **belum** posting stok/AP; stok + `upsertPayable` saat konfirmasi terima (`menunggu_selesai`).

**Nav keuangan → pembelian:** peran `keuangan` punya akses grup nav **Pembelian** (Pencatatan, Penerimaan, Pembayaran) lewat `NAV_GROUPS` — bukan hanya modul Keuangan — agar approve PO & selesai dari UI yang sama.

Hard-delete hanya `draft` / `ditolak`. Lot gabah (`lotId`) saat konfirmasi timbang. Potongan kadar air: rafaksi berat + harga per % di atas standar.

### Keuangan — Payroll — `PayrollStatus`

```
draft → menunggu_approve → siap_cair → posted → void
```

Dual control: `siap_cair` hanya jika `hasApproval(admin)` **dan** `hasApproval(keuangan)`.

| Aksi | Peran |
| --- | --- |
| Buat / edit draft | admin, keuangan |
| Ajukan approve | admin, keuangan |
| Stamp admin | **hanya** `admin` (`approveAsAdmin`) |
| Stamp keuangan | **hanya** `keuangan` (`approveAsKeuangan`) — admin tidak boleh double-stamp |
| Cair (`posted`) | keuangan, admin | wajib `transferProof`; `addCashEntry` out |
| Void | admin, keuangan |

Edit baris gaji di `menunggu_approve` / `siap_cair` reset approvals (konfirmasi `ConfirmDialog` / `PromptDialog`, bukan native).

### Bukti lampiran (`ProofAttachment`)

Reuse upload → `{ name, size, previewUrl?, mime }` atau string `receiptName`.

| Konteks | Field | Wajib |
| --- | --- | --- |
| Ajukan PO (`draft` → `diajukan`) | `invoiceProof` | Ya |
| Terima / selesai PO | `purchaseProof` | Ya sebelum `selesai` |
| Bayar AP / cair payroll | `transferProof` | Ya saat bayar / post |
| Timbang gabah | `weighing.receiptName` | Opsional (tetap) |

Helper approval: `src/features/workflow/approvals.ts` (`ApprovalStamp`, `hasApproval`, `upsertApproval`).

### Penjualan (ringkas)

- Void setelah dikirim: reverse stok + hapus AR tertaut (`voidedAt`) + reverse jurnal `so:*`.
- Hard-delete hanya tahap awal (`dibuat`).
- Limit kredit pelanggan dicek saat kirim dengan settlement `kredit`.
- **`SaleOrder.lotId`:** diisi wajib saat **kirim** (lot costing giling / `LotCost`). Draft boleh tanpa lot.
- **COGS GL:** `qty × LotCost.costPerKgBeras` (asumsi qty kg). **Tidak** fallback ke `costPrice` master. Tanpa LotCost valid → blokir kirim / post retur.
- **Retur jual COGS:** memakai `order.lotId` SO asal (bukan pilih lot ulang). Order lama tanpa `lotId` tidak bisa post retur COGS.

### Pembelian — retur — `ReturnStage` (`PurchaseReturn`)

Storage: array `returns` di `egabah.pembelian.v1` (migrasi bundle menambah `returns: []` bila absen).

```
draft → diajukan → disetujui → posted
                 ↘ ditolak (edit → draft → ajukan ulang)
```

| Field inti | Keterangan |
| --- | --- |
| `id`, `purchaseId`, `lotId?` | Soft-link ke PO / lot timbang |
| `lines[]` | `{ sku, qty }` — qty ≤ sisa setelah retur posted sebelumnya |
| `reason`, `stage`, `approvals?`, `postedAt?` | |

| Aksi | Peran | Efek |
| --- | --- | --- |
| Ajukan | pembelian, admin | — |
| Approve / tolak / post | keuangan, admin | Post: stok **out** (kembali ke pemasok); **`creditPayable`** kurangi outstanding AP PO asal (bukan hard-delete PO) |

Hard-delete hanya `draft` / `ditolak`. Konfirmasi lewat `ConfirmDialog` / `PromptDialog`, bukan native.

### Penjualan — retur — `ReturnStage` (`SaleReturn`)

Storage: array `returns` di `egabah.penjualan.v1`.

Alur stage sama dengan retur pembelian. Post: stok **in**; **`creditReceivable`** kurangi outstanding AR order asal. Peran: ajukan = penjualan\|admin; approve/post = keuangan\|admin.

### Pembelian — QC lot — `LotQc`

Key = `lotId` dari timbang PO. Satu record aktif per lot (upsert) di `lotQc` pada `egabah.pembelian.v1`.

| Field | Keterangan |
| --- | --- |
| `moisture`, `impurity`, `brokenPct` | Angka % |
| `grade` | `A` \| `B` \| `C` \| `reject` |
| `passed` | boolean |
| `overrideReason?` | Wajib jika terima barang saat `!passed` (override admin, teraudit) |

**Gate penerimaan:** konfirmasi terima PO membutuhkan QC `passed` **atau** override admin + alasan. Isi QC: pembelian\|gudang\|admin; override: admin saja.

### Produksi — packing — `PackRun`

Dari batch `done`: pecah satu output giling ke SKU kemasan/grade. Storage: `packRuns` di `egabah.produksi.v1`.

```
draft → posted  (koreksi material = void pack + buat baru)
```

Post: stok **out** SKU sumber giling; **in** ke baris kemasan/grade. Tolak jika stok sumber kurang. Peran: produksi\|admin.

### Produksi — costing lot — `LotCost` (snapshot)

Storage: `lotCosts` di `egabah.produksi.v1`. Bukan workflow approve; dihitung/disimpan saat batch selesai atau hitung ulang dari UI Rendemen.

```
costPerKgBeras = (nilaiGabahEfektifLot + alokasiBiayaOps) / qtyBerasHasil
```

Nilai gabah dari PO terkait lot; alokasi ops manual atau proporsional qty batch vs biaya `posted` periode (`method`: `manual` \| `proportional`). Snapshot tidak berubah saat master harga berubah. Tampil di **Rendemen** (ranking) dan **Laporan** (tab Produksi → blok costing per lot).

## Akuntansi GL (gelombang 2a)

**Storage:** `egabah.gl.v1` (COA + jurnal + mapping), dimuat bersama snapshot `egabah.keuangan.v1` di finance-store.

### Entitas GL

| Entitas | File | Keterangan |
| --- | --- | --- |
| `Account` | `gl-data.ts` | `code`, `name`, `type` (`asset` \| `liability` \| `equity` \| `revenue` \| `expense`), `isPostable`, `active`, `system` |
| `AccountMap` | ↑ | Kunci posting tetap (`cash`, `ap`, `ar`, `inventoryGabah`, `inventoryBeras`, `wip`, `cogs`, `sales`, `salesReturn`, …) → `accountId` |
| `JournalEntry` / `JournalLine` | ↑ | Double-entry; `sourceType` `auto` \| `manual` \| `opening` \| `reverse`; void via `voidedAt` + pasangan reverse |
| `FailedJournalPost` | ↑ | Antrean tipis jika ops sukses tetapi `postJournal` gagal — `{ sourceKey, payload, error, createdAt }`; retry dari UI Jurnal |

Laporan resmi 2a (**Laporan → Neraca saldo / Laba rugi / Neraca**) memakai `accountBalanceMap(journals)` — jurnal dengan `voidedAt` diabaikan.

### Dual-track (kas / AP / AR vs GL)

Layar **Kas, Utang, Piutang, Biaya, Payroll** tetap sumber kerja harian (`upsertPayable`, `creditPayable`, `creditReceivable`, `addCashEntry`, dll.). Setelah event ops sukses, builder jurnal memanggil `postJournal` paralel. Void ops → `reverseJournal`. Gagal auto-journal → `FailedJournalPost` + **toast di halaman pemicu** (ops tidak di-rollback). Tidak ada backfill historis; saldo awal lewat jurnal `opening` ke `openingEquity`.

### Produksi — WIP + jurnal

| Tahap | Stok | Jurnal (contoh `sourceKey`) |
| --- | --- | --- |
| **Start batch** | Gabah out lokasi input → WIP | `batch:{id}:start` — Dr WIP, Cr persediaan gabah |
| **Complete batch** | Output beras in (gabah sudah dikonsumsi di start) | `batch:{id}:done` — Dr FG (LotCost), Cr WIP + alokasi overhead |
| **Pack posted** | Reclass SKU | `pack:{id}:post` |
| **Void** | Reverse stok seperti gelombang 1 | Reverse jurnal pasangan |

`LotCost` tetap snapshot nilai; jurnal complete memakai total cost yang sama dengan modul produksi.

### Laporan GL (ringkas)

- **Neraca saldo:** akun postable aktif, kolom debit/kredit dari saldo bertanda (nature akun).
- **Laba rugi:** pendapatan − beban; `salesReturn` tipe `revenue` kontra (mengurangi pendapatan).
- **Neraca:** aset vs utang + ekuitas + laba rugi berjalan.

### Di luar scope 2a

PPN / e-Faktur, rekonsiliasi bank, tutup buku enforced, dan **backfill** jurnal untuk transaksi sebelum go-live GL. Gelombang 1 (retur, QC, pack, costing) sudah ada di ops; jurnal auto hanya **forward** dari aktivasi 2a.

## Produksi — struktur batch

- Input: 1 baris gabah (`sku`, `qty`, `fromLocation`)
- Output: N baris (beras / menir / dedak / sekam)
- Rendemen aktual = `(qty beras / qty input) * 100`
- Neraca massa = `sum(output) - input` (toleransi dari settings bila ada)

## Audit

Setiap aksi domain menulis `AuditLog`: `{ id, at, actor, action, entity, entityId, before?, after?, note? }`.

## Sync (pra-cloud)

`syncBus` lokal: `BroadcastChannel('egabah-sync')` untuk multi-tab. Diganti Realtime Supabase / Firestore listener tanpa mengubah UI.
