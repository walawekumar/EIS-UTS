# Spek: Akuntansi GL — COA, jurnal otomatis/manual, laporan dasar (gelombang 2a)

Tanggal: 2026-10-30  
Status: approved (user: approve)  
Pra-syarat: gelombang 1 (retur, QC, pack, LotCost) sudah di `main`

## Tujuan

Menambah buku besar double-entry di E-Gabah tanpa merombak kas/AP/AR operasional: COA editable (seed), jurnal otomatis seiring event ops (termasuk WIP produksi), jurnal manual + saldo awal, laporan GL dasar — masih localStorage, tanpa PPN/e-Faktur/rekon bank/tutup buku.

## Roadmap disepakati (potongan)

| Gelombang | Isi | Status |
| --- | --- | --- |
| 1 | Retur + QC + pack + costing (tanpa jurnal) | Done di `main` |
| **2a (spek ini)** | COA + jurnal auto/manual + WIP + laporan GL dasar | Desain |
| 2b | PPN 11%/0% + e-Faktur mock | Spek terpisah setelah 2a |
| 2c | Rekonsiliasi bank + tutup periode enforced | Spek terpisah |
| DB | Persistensi cloud | Setelah fitur di atas |

## Keputusan desain (brainstorm)

| Topik | Pilihan |
| --- | --- |
| Scope | 2a saja (bukan paket handoff penuh) |
| Timing jurnal | Seiring event ops; void → reverse |
| Kas / AP / AR vs GL | Dual-track (ops UI tetap; GL paralel) |
| Produksi | WIP penuh: start → WIP; done → FG; pack → reclass |
| Data lama | Forward-only + saldo awal manual (tanpa backfill) |
| Arsitektur | Engine di finance helpers/store (`postJournal` / `reverseJournal`) |

## Pendekatan

Perluas `features/keuangan` (+ helper GL terpisah file bila perlu). Hook `postJournal` dipanggil dari context yang sudah menulis kas/AP/AR/stok. UI keuangan baru: Bagan akun, Jurnal, Saldo awal; LaporanPage menambah view dari saldo jurnal. Pola UI: OpsChrome / drawer + ConfirmDialog.

## Entitas & persistence

**Key:** `egabah.gl.v1` (terpisah dari `egabah.keuangan.v1`). Finance-store me-load/simpan GL berdampingan dengan snapshot kas/AP/AR.

### `Account`

| Field | Keterangan |
| --- | --- |
| `id`, `code`, `name` | Kode unik (mis. `1-1100`) |
| `type` | `asset \| liability \| equity \| revenue \| expense` |
| `parentId?` | Hierarki tampilan; posting hanya ke `isPostable` |
| `isPostable`, `active` | Nonaktifkan seed sistem; jangan hard-delete jika pernah dipakai |
| `system` | Seed default; tidak boleh dihapus |

### `AccountMap` (default posting)

Kunci tetap: `cash`, `ap`, `ar`, `inventoryGabah`, `inventoryBeras`, `wip`, `cogs`, `sales`, `salesReturn`, `expenseOps`, `payroll`, `mfgOverhead`, `openingEquity`. Disimpan di snapshot GL; diubah keuangan|admin.

### `JournalEntry` / `JournalLine`

| Field | Keterangan |
| --- | --- |
| `id`, `date`, `memo` | |
| `sourceKey` | Unik bila diisi; idempotency untuk auto-post |
| `sourceType` | `auto \| manual \| opening \| reverse` |
| `manual` | true untuk jurnal manual / opening |
| `lines[]` | `{ accountId, debit, credit, memo? }` — satu sisi nol |
| `voidedAt?`, `reversesId?`, `reversedById?` | Pair reverse |
| `createdBy`, `createdAt` | Audit ringan |

Entry yang tersimpan = sudah posted. Antrean gagal: `FailedJournalPost`, bukan status di entry.

### `FailedJournalPost` (antrean tipis)

Jika ops sudah sukses tapi `postJournal` gagal: simpan `{ sourceKey, payload, error, createdAt }` agar UI Jurnal bisa **retry** tanpa mengulang gerakan stok/kas. Sukses retry → hapus dari antrean. `sourceKey` yang sudah ada di journals → retry no-op sukses.

## Engine

- `postJournal(input)` — tolak jika Σ debit ≠ Σ credit, akun non-postable/nonaktif, atau `sourceKey` sudah ada (return existing / error idempotent “already posted”).
- `reverseJournal(sourceKey | id)` — buat entry baru (swap D/C), set link pair; idempotent jika sudah di-reverse.
- Opening: UI Saldo awal membangun satu (atau beberapa) jurnal `sourceType: opening`, `manual: true`, tanpa `sourceKey` ops — balance ke `openingEquity`.
- Tidak ada backfill historis di 2a.

## Dual-track

API kas / `upsertPayable*` / `creditPayable` / `creditReceivable` / expense / payroll **tetap**. Setelah sukses, panggil builder jurnal + `postJournal`. Laporan keuangan “resmi” 2a = dari GL; layar Kas/Utang/Piutang tetap untuk kerja harian.

## Peta auto-post (sourceKey)

| Event | sourceKey (contoh) | Debit | Credit |
| --- | --- | --- | --- |
| Terima PO (AP) | `po:{id}:receive` | Persediaan gabah | Utang usaha |
| Bayar AP | `po:{id}:pay:{payId}` | Utang | Kas |
| Retur beli posted | `pr:{id}:post` | Utang | Persediaan gabah |
| Kirim SO | `so:{id}:ship` | Piutang; COGS | Penjualan; Persediaan beras |
| Bayar AR / COD | `so:{id}:pay:…` / `:cod` | Kas | Piutang |
| Retur jual posted | `sr:{id}:post` | `salesReturn`; Persediaan beras | Piutang; COGS |
| Biaya posted | `ex:{id}:post` | Beban | Kas |
| Payroll cair | `payrun:{id}:post` | Beban gaji | Kas |
| Start batch | `batch:{id}:start` | WIP | Persediaan gabah |
| Complete batch | `batch:{id}:done` | Persediaan beras = LotCost.totalCost | WIP = nilai start (grain); selisih `allocatedOps` → Cr `mfgOverhead` (kapitalisasi alokasi, bukan kas baru) |
| Pack posted | `pack:{id}:post` | Persediaan SKU tujuan | Persediaan SKU sumber |
| Void terkait | reverse pasangan | via `reverseJournal` | |

Nilai: pakai amount yang sama dengan AP/AR/kas/LotCost / effective unit price yang sudah dihitung modul asal.

## Implikasi stok WIP

Hari ini stok batch diposting di `completeBatch`. Untuk WIP penuh:

1. **`startBatch`:** konsumsi qty input gabah dari lokasi asal → WIP (stok + jurnal `batch:{id}:start`).
2. **`completeBatch`:** jangan konsumsi gabah lagi (sudah di start); post output beras ke lokasi tujuan; jurnal `batch:{id}:done` (FG = LotCost.totalCost; Cr WIP grain; Cr mfgOverhead = allocatedOps); LotCost tetap snapshot.
3. **Void** start/complete/pack: balik stok seperti sekarang **dan** `reverseJournal`.

Pack: tetap hanya setelah batch `done`; reclass SKU + jurnal.

## UI & peran

| Layar | Isi | Peran |
| --- | --- | --- |
| Bagan akun | List/tree, tambah, edit, nonaktifkan | lihat: keuangan\|admin; ubah: keuangan\|admin |
| Jurnal | List, filter, detail, manual multi-line, reverse, retry failed | keuangan\|admin |
| Saldo awal | Form opening | keuangan\|admin |
| Mapping akun | Edit AccountMap | keuangan\|admin |
| Laporan GL | Neraca saldo, laba rugi, neraca | keuangan\|admin |

Nav group keuangan. ConfirmDialog untuk reverse/void. Tanpa `window.confirm`.

## Error handling

- Jurnal unbalanced / akun invalid → jangan tulis entry.
- Ops sukses, jurnal gagal → FailedJournalPost + toast; retry dari Jurnal.
- Idempotent `sourceKey` mencegah double post saat retry/re-render.

## Testing / acceptance

1. `npx tsc -p tsconfig.app.json --noEmit` hijau.
2. Terima PO → jurnal Dr inventory Cr AP; bayar → Dr AP Cr kas.
3. Start batch → stok ke WIP + jurnal; complete → FG + jurnal; void → reverse + stok balik.
4. Pack post → reclass + jurnal; void pack → reverse.
5. Manual JE unbalanced ditolak; opening balance muncul di neraca saldo.
6. Forward-only: dokumen lama tanpa jurnal sampai ada event baru / opening.

## Out of scope (2a)

- PPN, e-Faktur, rekonsiliasi bank, tutup buku / `lockPeriod` enforced
- Backfill jurnal historis
- Redesign Kas/Utang/Piutang menjadi view murni dari GL
- Multi-currency, fixed assets, cost centers

## Handoff 2b / 2c

Setelah 2a stabil: spek PPN + e-Faktur mock; lalu rekon bank + period close yang memblokir post ke periode terkunci.

## DOMAIN

Update `docs/DOMAIN.md`: entitas Account/Journal, dual-track, WIP start/complete, batas 2a (tanpa PPN).
