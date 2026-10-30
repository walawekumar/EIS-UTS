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
| TaxDoc / TaxInvoice / TaxSettings | Keuangan (PPN) | `egabah.tax.v1` |
| PeriodLock / UnlockRequest | Keuangan (periode) | `egabah.period.v1` |
| BankSession / BankLine | Keuangan (rekon bank) | `egabah.bank.v1` |
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
| `AccountMap` | ↑ | Kunci posting tetap (`cash`, `ap`, `ar`, `inventoryGabah`, `inventoryBeras`, `wip`, `cogs`, `sales`, `salesReturn`, `ppnOut`, `ppnIn`, …) → `accountId` |
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

### Di luar scope 2a / belum

Integrasi **API DJP** e-Faktur sungguhan dan **backfill** jurnal untuk transaksi sebelum go-live GL. Gelombang 1 (retur, QC, pack, costing) sudah ada di ops; jurnal auto hanya **forward** dari aktivasi 2a.

**Gelombang 2b (PPN + e-Faktur mock)** sudah diimplementasi — lihat bagian berikut. Tidak ada backfill `TaxDoc` / jurnal PPN untuk transaksi lama.

## Tutup periode & rekon bank (gelombang 2c)

**Storage:** `egabah.period.v1` (`period-data.ts`, `period-storage.ts`, `PeriodProvider`) dan `egabah.bank.v1` (`bank-data.ts`, `bank-storage.ts`, `BankProvider`).

### Kunci periode

- `PeriodLock`: grain **bulan** (`YYYY-MM`) atau **rentang** kustom; overlap kunci aktif ditolak.
- Post/void dengan tanggal dokumen di rentang kunci aktif → **`assertPeriodOpen(isoDate)`** mengembalikan pesan error (dipanggil **sebelum** mutasi, tanpa half-post).
- **Unlock:** `UnlockRequest` + alasan → `requiredRoles` dihitung snapshot dari transaksi di rentang (penjualan, pembelian, produksi, gudang/mutasi, keuangan) → approve **hanya** role yang terdampak → **admin final** → `active=false` + `unlockHistory`. Reject menjaga kunci aktif.

**Call-site gate (contoh):** kirim/void SO, terima/void PO, retur, kas in/out, biaya posted/void, payroll post/void, jurnal manual/reverse/retry, batch start/complete/void, pack post/void, koreksi stok, **penyesuaian rekon bank** (`postAdjustment`).

UI: `/app/keuangan/periode` (nav juga untuk role terdampak unlock).

### Rekon bank

- Satu rekening kas = `AccountMap.cash`; CSV → `BankLine` (tanggal ISO, jumlah bertanda).
- **Auto-match:** nominal kas **exact** (signed) + tanggal kas (parse `formatDateId` via `parseCashDateToIso`) dalam **±2 hari** → `suggestedCashEntryId`; terima/tolak manual.
- Match manual / abaikan baris.
- **Penyesuaian GL-only** (tanpa `CashEntry` baru): JE `sourceKey` `bank:{sessionId}:adj:{lineId}` — Dr/Cr `cash` vs `bankSuspense`; gate periode pada `line.date`. Gagal JE → error ke UI (dual-track toast).

Seed COA + map: **`bankSuspense`** (`acc-bank-suspense`, 1-1600).

UI: `/app/keuangan/rekon-bank` (`admin` \| `keuangan`).

### Out of scope 2c

Feed bank nyata (OFX/API), multi-rekening, kunci otomatis akhir bulan, unlock tanpa admin final, rekon langsung AP/AR, backfill kunci/rekon historis.

## PPN & e-Faktur (gelombang 2b)

**Storage:** `egabah.tax.v1` (`tax-data.ts`, `tax-storage.ts`, `TaxProvider` / `useTaxStore`). Tipe sumber kebenaran selaras dengan snapshot pajak di dokumen ops.

### Entitas pajak

| Entitas | Keterangan |
| --- | --- |
| `TaxSettings` | `npwp`, `invoicePrefix`, `nextSeq`, `defaultRate` (`0` \| `11`), `defaultPriceMode` (`exclusive` \| `inclusive`) |
| `TaxDoc` | Jejak pajak per sumber: `sourceType` (`sale` \| `purchase` \| `expense` \| `saleReturn` \| `purchaseReturn`), `sourceId`, `date`, `ppnRate`, `priceMode`, `dpp`, `ppn`, `total`, `partyName?`, `supplierFakturNo?` (pembelian), `voidedAt?` |
| `TaxInvoice` | Faktur pajak keluaran **mock** (bukan DJP): `number`, `taxDocId`, `saleOrderId`, `status` (`draft` \| `sent` \| `failed` \| `void`), `dpp` / `ppn` / `total`, `sentAt?`, `failReason?` |

`TaxSnapshotFields` (`ppnRate`, `priceMode`, `dpp`, `ppn`, `totalWithTax`) disalin ke **SaleOrder**, **SaleReturn**, **Purchase**, **PurchaseReturn**, dan baris **Expense** saat post/kirim/terima.

### `computePpn` (`tax-compute.ts`)

Input: `subtotal` (nilai baris/dokumen sebelum pajak menurut mode), `rate`, `priceMode`. Semua rupiah dibulatkan integer.

| Rate | Mode | Hasil |
| --- | --- | --- |
| `0` | apa pun | `dpp = subtotal`, `ppn = 0`, `total = subtotal` |
| `11` | `exclusive` | `dpp = subtotal`, `ppn = round(dpp × 11%)`, `total = dpp + ppn` |
| `11` | `inclusive` | `total = subtotal`, `dpp = round(total ÷ 1,11)`, `ppn = total − dpp` |

Default UI: `TaxSettings`, lalu `readAppSettings().finance.ppnRate`, lalu 11% exclusive (`resolve*TaxDefaults` per modul).

### Dual-track: total ops vs DPP/PPN di GL

- **Subledger (AR / AP / kas / piutang):** nominal outstanding dan pembayaran memakai **`calc.total`** (tersimpan sebagai `totalWithTax` pada dokumen sumber).
- **GL:** pendapatan / persediaan / beban memakai **`dpp`**; PPN memakai akun map **`ppnOut`** (keluaran, kredit saat jual) atau **`ppnIn`** (masukan, debit saat beli/biaya).
- Ringkasan daftar (`summarize` penjualan/pembelian): `totalWithTax ??` fallback subtotal lama (data pra-PPN).
- Gagal `postJournal` setelah ops sukses → `FailedJournalPost` + **`journalError` toast** di halaman pemicu (ops tidak di-rollback), sama pola gelombang 2a.

### Mapping akun PPN

Seed COA: `acc-ppn-out` (utang PPN keluaran), `acc-ppn-in` (aset PPN masukan). Kunci `AccountMap`: `ppnOut`, `ppnIn` — dapat diubah di **Keuangan → Pemetaan akun**.

### Jurnal otomatis (contoh)

| Event | Ops (total) | Baris GL (selain COGS/stok yang sudah ada) |
| --- | --- | --- |
| Kirim SO | AR / kas `total` | Cr `sales` `dpp`; jika `ppn > 0` Cr `ppnOut` `ppn` |
| Retur jual posted | Kurangi AR `total` | Dr `salesReturn` `dpp`; jika PPN Dr `ppnOut` |
| Terima PO | AP `total` | Dr `inventoryGabah` `dpp`; jika PPN Dr `ppnIn` |
| Retur beli posted | Kurangi AP `total` | Cr persediaan `dpp`; jika PPN Cr `ppnIn` |
| Biaya posted | Kas out `total` | Dr `expenseOps` `dpp`; jika PPN Dr `ppnIn` |

Void dokumen sumber → reverse jurnal + **`voidTaxForSource`** (`TaxDoc.voidedAt`, `TaxInvoice` → `void`).

### `TaxInvoice` & e-Faktur UI

- Dibuat hanya saat **kirim penjualan** dengan **`ppn > 0`** (`recordSaleInvoice`); tarif 0% → **tanpa** `TaxInvoice`.
- Halaman **`/app/keuangan/e-faktur`**: daftar faktur, filter, drawer detail, pengaturan NPWP/prefix/default, **unduh CSV** (`buildEfakturCsv`), **kirim mock** (`sendInvoiceMock` → `sent` atau `failed` jika simulasi gagal). **Tidak** memanggil API Coretax/DJP.

## Produksi — struktur batch

- Input: 1 baris gabah (`sku`, `qty`, `fromLocation`)
- Output: N baris (beras / menir / dedak / sekam)
- Rendemen aktual = `(qty beras / qty input) * 100`
- Neraca massa = `sum(output) - input` (toleransi dari settings bila ada)

## Audit

Setiap aksi domain menulis `AuditLog`: `{ id, at, actor, action, entity, entityId, before?, after?, note? }`.

## Sync (pra-cloud)

`syncBus` lokal: `BroadcastChannel('egabah-sync')` untuk multi-tab. Diganti Realtime Supabase / Firestore listener tanpa mengubah UI.
