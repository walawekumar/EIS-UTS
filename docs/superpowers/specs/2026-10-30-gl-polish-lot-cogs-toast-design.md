# Spek: Polish GL 2a — LotCost COGS + toast gagal jurnal

Tanggal: 2026-10-30  
Status: draft (menunggu review user)  
Pra-syarat: gelombang 2a (COA + jurnal + laporan GL) sudah di `main`

## Tujuan

Menutup dua celah review 2a sebelum spek 2b (PPN) / 2c (rekon + tutup buku): (1) COGS penjualan/retur memakai **LotCost** via lot eksplisit di SO, bukan `costPrice` master; (2) gagal auto-journal tampil **toast di halaman pemicu**, tetap masuk `failedPosts`.

## Roadmap konteks

| Urutan | Isi | Status |
| --- | --- | --- |
| 2a | COA + jurnal + WIP + laporan | Done di `main` |
| **Polish 2a (spek ini)** | Lot COGS + toast gagal journal | Desain |
| 2b | PPN 11%/0% + e-Faktur mock | Spek terpisah berikutnya |
| 2c | Rekon bank + tutup periode | Spek terpisah |

## Keputusan desain (brainstorm)

| Topik | Pilihan |
| --- | --- |
| Scope polish | Toast + COGS LotCost (bukan toast-only / bukan skip) |
| Alokasi lot | Eksplisit: wajib pilih lot saat **kirim** SO |
| Retur jual COGS | Lot sama dengan SO asal (`order.lotId`) |
| Toast | Di halaman yang memicu aksi + antrean `failedPosts` (bukan bus global) |
| Pendekatan | Wire tipis penjualan + propagate error helper → UI |

## Data model

### `SaleOrder`

- Tambah `lotId?: string`.
- Diisi saat kirim berhasil; draft boleh tanpa lot.
- Persist di snapshot penjualan yang ada (`egabah.penjualan.v1`).

### `DeliveryInput`

- Tambah `lotId: string` (wajib untuk `shipOrder`).

### COGS

```
cogsAmount = order.qty * LotCost.costPerKgBeras   // ship
cogsAmount = returnQty * LotCost.costPerKgBeras   // sale return, lot = order.lotId
```

- Sumber: `lotCosts` produksi (`LotCost` untuk `lotId`).
- Asumsi: `order.qty` dalam kg beras (sama basis `costPerKgBeras`). Tidak konversi unit di polish.
- **Tidak** fallback ke `lookupProductBySku(sku).costPrice`.
- Jika `lotId` kosong, LotCost tidak ada, atau `costPerKgBeras <= 0` → **blokir kirim** (return error string); stok/AR tidak dipost.
- Retur: jika SO tanpa `lotId` (order lama) atau LotCost hilang → blokir post retur dengan pesan jelas (tidak diam-diam pakai master).
- Lot di sini = lot costing giling (bukan serial stok kemasan); satu SO satu lot.

Jurnal keys tidak berubah: `so:{id}:ship`, `sr:{id}:post` (dan pasangan revenue/AR seperti 2a).

## Toast gagal auto-journal

- `postJournalEntry` sudah mengembalikan `string | undefined` (error) dan meng-enqueue `failedPosts` bila ada `sourceKey`.
- Helper auto-pair di pembelian / penjualan / produksi / biaya / payroll: **return** error ke caller (bukan `void` yang membuang hasil).
- Halaman pemicu (kirim, terima, bayar, retur, post biaya, payroll post, dll.): tampilkan toast error lokal (`FinanceToast` atau pola setara) jika helper/store mengembalikan error.
- Dual-track tetap: ops kas/AP/AR/stok yang sudah sukses **tidak** di-rollback oleh gagal journal; user retry dari Jurnal → failedPosts.
- Out of polish: badge shell global, link “Buka Jurnal” di toast.

## UI

- Form/dialog kirim di alur pengiriman: select lot dari `lotCosts` yang punya `costPerKgBeras > 0` (label: lotId + cost/kg + batch bila berguna).
- Filter lot ke konteks produk beras yang masuk akal bila data batch/SKU tersedia; jika ambigu, tampilkan semua LotCost valid dan validasi di `shipOrder`.
- Retur jual: tidak pilih lot ulang; tampilkan lot SO (read-only) bila ada.

## Verifikasi

1. `npx tsc -p tsconfig.app.json --noEmit`
2. Kirim SO dengan lot → jurnal COGS = qty × costPerKgBeras LotCost
3. Kirim tanpa lot / tanpa LotCost → error, tidak ship
4. Retur dari SO ber-lot → COGS balik dengan rate lot yang sama
5. Simulasikan gagal journal (mis. akun map invalid) → toast di halaman + item di failedPosts; ops track tetap

## Out of scope

- PPN / e-Faktur (2b)
- Rekon bank / tutup periode (2c)
- FIFO atau multi-lot per satu SO
- Backfill COGS order lama yang sudah dikirim tanpa `lotId`
- Redesign Kas/Utang/Piutang
- E2E otomatis / Vitest baru (kecuali sudah ada di repo)

## DOMAIN

Setelah implement: catat `SaleOrder.lotId` dan aturan COGS LotCost di `docs/DOMAIN.md` (bagian penjualan / GL).

## Handoff

Setelah polish merge ke `main`: brainstorm + spek **2b** (PPN + e-Faktur mock), lalu **2c**.
