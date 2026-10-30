# Spek: PPN 11%/0% + e-Faktur mock (gelombang 2b)

Tanggal: 2026-10-30  
Status: draft (menunggu review user)  
Pra-syarat: gelombang 2a + polish LotCost/toast sudah di `main`

## Tujuan

Menambah PPN pada dokumen bernilai (jual, beli, biaya) dengan tarif dan mode harga dipilih per dokumen, jurnal GL dual-track ke akun PPN keluaran/masukan, serta e-Faktur mock (nomor lokal, export CSV gaya DJP, status kirim mock) — masih localStorage, tanpa API DJP nyata.

## Roadmap

| Gelombang | Isi | Status |
| --- | --- | --- |
| 2a + polish | COA/jurnal/WIP + LotCost COGS + toast | Done di `main` |
| **2b (spek ini)** | PPN + e-Faktur mock | Desain |
| 2c | Rekon bank + tutup periode | Spek terpisah |
| DB | Persistensi cloud | Setelah fitur di atas |

## Keputusan desain (brainstorm)

| Topik | Pilihan |
| --- | --- |
| Cakupan dokumen | Semua bernilai: penjualan, pembelian, biaya |
| Tarif | Per dokumen: user pilih **11%** atau **0%** saat post (bukan auto dari `product.taxable`) |
| Basis harga | Per dokumen: **exclusive** atau **inclusive** |
| Arsitektur | Modul pajak tipis `egabah.tax.v1` + hook dual-track ke GL |
| e-Faktur | Nomor + daftar + CSV gaya DJP + **kirim mock** (`sent` / `failed`) |
| Master `taxable` | Tetap di produk (informasi); tidak memaksa tarif di 2b |

## Pendekatan

Modul tipis di `features/keuangan/tax-*` (types, storage `egabah.tax.v1`, `computePpn`, repository faktur). Context penjualan/pembelian/biaya memanggil helper saat post, menyimpan snapshot pajak di dokumen sumber **dan** `TaxDoc`, lalu memperluas jurnal auto (baris `ppnOut` / `ppnIn`). UI: kontrol rate+mode di form post; halaman e-Faktur di nav keuangan.

## Persistence — `egabah.tax.v1`

### Settings

| Field | Keterangan |
| --- | --- |
| `npwp` | String mock perusahaan |
| `invoicePrefix` | Prefix nomor faktur lokal |
| `nextSeq` | Sequence nomor |
| `defaultRate` | `11` \| `0` (default UI) |
| `defaultPriceMode` | `exclusive` \| `inclusive` |

Default rate UI boleh dari `app-settings.finance.ppnRate` (sudah 11) bila settings pajak belum diisi.

### `TaxDoc` (snapshot)

| Field | Keterangan |
| --- | --- |
| `id` | Id snapshot |
| `sourceType` | `sale` \| `purchase` \| `expense` \| `saleReturn` \| `purchaseReturn` |
| `sourceId` | Id dokumen ops |
| `date` | YYYY-MM-DD |
| `ppnRate` | `11` \| `0` |
| `priceMode` | `exclusive` \| `inclusive` |
| `dpp`, `ppn`, `total` | Angka hasil hitung |
| `partyName?`, `note?` | Untuk CSV / tampilan |
| `supplierFakturNo?` | Opsional (faktur masukan beli) |
| `createdAt` | ISO |

### `TaxInvoice` (faktur keluaran)

| Field | Keterangan |
| --- | --- |
| `id`, `number` | Nomor lokal unik |
| `taxDocId`, `saleOrderId` | Link |
| `status` | `draft` \| `sent` \| `failed` \| `void` |
| `sentAt?`, `failReason?` | Mock kirim |
| `dpp`, `ppn`, `total`, `date` | Mirror / denormalisasi untuk list cepat |

Hanya dibuat otomatis saat **ship penjualan** dengan `ppn > 0`. Rate 0% → tidak buat faktur keluaran.

## Perhitungan

`subtotalInput` = nilai dokumen hari ini sebelum PPN, mis. SO `qty * price`, nilai terima PO, jumlah biaya — **input form tidak diubah ke harga-satuan-PPN**.

```
exclusive: DPP = subtotalInput; PPN = round(DPP * rate/100); total = DPP + PPN
inclusive: total = subtotalInput; DPP = round(total / (1 + rate/100)); PPN = total - DPP
rate 0:    PPN = 0; DPP = subtotalInput (exclusive) atau total = subtotalInput (inclusive → DPP = total)
```

Pembulatan: ke rupiah integer (sama pola uang di app). Helper murni `computePpn({ subtotal, rate, priceMode })`.

### Snapshot di dokumen sumber

Saat post sukses, tulis ke SO / PO / expense / return (selain `TaxDoc`):

| Field | Keterangan |
| --- | --- |
| `ppnRate`, `priceMode` | Pilihan user |
| `dpp`, `ppn`, `totalWithTax` | Hasil `computePpn` |

- `summarize` / outstanding / pembayaran / credit AR·AP memakai **`totalWithTax`** (bukan `qty*price` mentah) bila snapshot ada.
- Dokumen lama tanpa snapshot → perilaku 2a (total = subtotal tanpa PPN); tidak backfill.
- `TaxDoc` = ledger pajak + sumber CSV; dokumen sumber = sumber kebenaran ops.

## Jurnal GL (perluas 2a)

Seed akun liability + `AccountMapKey`: `ppnOut` (PPN Keluaran), `ppnIn` (PPN Masukan). Map ke AccountMap UI.

| Event | Inti jurnal (selain COGS/dll. yang sudah ada) |
| --- | --- |
| Ship jual | Dr AR `total`; Cr Sales `dpp`; Cr `ppnOut` `ppn` (skip PPN jika 0) |
| Terima beli | Dr Inv `dpp`; Dr `ppnIn` `ppn`; Cr AP `total` |
| Post biaya | Dr Expense `dpp`; Dr `ppnIn` `ppn` (jika >0); Cr Cash `total` |
| Retur jual | Dr SalesReturn `dpp`; Dr `ppnOut` `ppn`; Cr AR `total` (+ COGS/stok seperti 2a/polish) |
| Retur beli | Dr AP `total`; Cr Inv `dpp`; Cr `ppnIn` `ppn` |

Bayar AP/AR/COD memakai **totalWithTax**. sourceKey pola 2a tetap (`so:{id}:ship`, dll.); PPN = baris tambahan di jurnal event yang sama, bukan JE terpisah.

Void dokumen → `reverseJournal` (2a) + tandai `TaxDoc` voided + faktur `draft` → dibatalkan (status `void` atau hapus dari list aktif); faktur `sent`/`failed` tidak dihapus — tandai void + catatan (mock).

Default UI rate/mode: settings pajak → fallback `app-settings.finance.ppnRate` + exclusive.

Forward-only: tidak backfill PPN dokumen lama.

## UI

1. **Form post** (kirim SO, terima PO, post biaya, post retur): select tarif 11/0 + mode exclusive/inclusive; preview DPP/PPN/total sebelum konfirmasi.
2. **`/app/keuangan/e-faktur`**: tabel faktur, filter status, detail, tombol **Kirim mock**, **Export CSV**.
3. Kirim mock: set `sent` setelah delay singkat; opsi gagal (toggle debug atau ~10% random — spek implementasi: **selalu sukses kecuali user pilih “Simulasikan gagal”** di dialog agar deterministik).
4. CSV: kolom minimal gaya DJP (NPWP, nomor, tanggal, nama lawan, DPP, PPN, total, …) — cukup latihan impor, bukan sertifikasi.
5. Nav: item e-Faktur; roles `admin` \| `keuangan`.
6. Settings pajak (NPWP, prefix) di halaman e-Faktur atau Settings keuangan — satu tempat saja (e-Faktur page header/settings drawer).

## Verifikasi

1. `npx tsc -p tsconfig.app.json --noEmit`
2. Ship exclusive 11%: AR=total, sales=DPP, ppnOut=PPN; faktur draft muncul
3. Ship 0%: tidak ada baris PPN / tidak ada TaxInvoice
4. Inclusive 11%: DPP+PPN=total input
5. Terima PO + biaya dengan PPN: ppnIn terisi; AP/kas = total
6. Export CSV mengunduh file; kirim mock → `sent`; simulasikan gagal → `failed`
7. Dual-track toast tetap jika jurnal gagal

## Out of scope (2b)

- API / Coretax / certificate DJP nyata
- PPN otomatis dari `product.taxable` (flag informational saja)
- PPN payroll / aset tetap / multi-cabang NPWP
- Rekon bank, tutup periode (2c)
- Backfill PPN historis
- Vitest baru (kecuali sudah ada di repo)

## DOMAIN

Dokumentasikan `TaxDoc`, `TaxInvoice`, AccountMap `ppnOut`/`ppnIn`, aturan hitung, dual-track total vs DPP.

## Handoff 2c

Setelah 2b stabil: spek rekon bank + `lockPeriod` yang memblokir post ke periode terkunci.
