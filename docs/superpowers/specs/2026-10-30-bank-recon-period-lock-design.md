# Spek: Rekon bank + tutup periode (gelombang 2c)

Tanggal: 2026-10-30  
Status: draft (menunggu review user)  
Pra-syarat: gelombang 2a + polish + 2b (PPN/e-Faktur) sudah di `main`

## Tujuan

Menambah tutup periode yang memblokir semua post bertanggal di rentang terkunci (dengan unlock berjenjang: role terdampak → admin final), serta rekonsiliasi bank dari CSV (auto-match ke kas, match manual, jurnal penyesuaian) — masih localStorage, tanpa API/OFX bank nyata.

## Roadmap

| Gelombang | Isi | Status |
| --- | --- | --- |
| 2a + polish | COA/jurnal/WIP + LotCost COGS + toast | Done di `main` |
| 2b | PPN + e-Faktur mock | Done di `main` |
| **2c (spek ini)** | Rekon bank + tutup periode enforced | Desain |
| DB | Persistensi cloud | Setelah fitur di atas |

## Keputusan desain (brainstorm)

| Topik | Pilihan |
| --- | --- |
| Cakupan 2c | Keduanya: rekon bank **dan** kunci periode |
| Rekon | CSV + auto-match + jurnal adj |
| Efek kunci | Blokir **semua** post/void yang menulis `date` di periode terkunci |
| Unlock | Soft via **permintaan** + approve role terdampak saja + **admin final** |
| Grain periode | Bulan (`YYYY-MM`) default **atau** rentang kustom |
| Arsitektur | Modul terpisah: `egabah.period.v1` + `egabah.bank.v1` |

## Pendekatan

Dua modul tipis di `features/keuangan` (period-* / bank-*), pola seperti tax 2b. Gate tunggal `assertPeriodOpen(isoDate)` dipanggil **sebelum** mutasi di context ops/keuangan. Rekon membaca `cashEntries` + AccountMap `cash`; adj JE lewat `postJournal` dual-track. UI: `/app/keuangan/periode` + `/app/keuangan/rekon-bank` (roles `admin` \| `keuangan`; approve unlock juga tampil untuk role terdampak yang login).

---

## Persistence — `egabah.period.v1`

### `PeriodLock`

| Field | Keterangan |
| --- | --- |
| `id` | Id kunci |
| `kind` | `month` \| `range` |
| `yearMonth?` | `YYYY-MM` jika `kind=month` |
| `startDate`, `endDate` | Inclusive YYYY-MM-DD; untuk month diisi dari kalender bulan itu |
| `active` | `true` selama terkunci |
| `lockedAt`, `lockedBy` | Audit kunci |
| `unlockHistory[]` | `{ at, by, reason, requestId? }` — tiap kali berhasil unlock |
| `pendingUnlockRequestId?` | Id request aktif (jika ada) |

Satu tanggal hanya boleh dicakup **satu** kunci aktif; tolak overlap saat create.

### `UnlockRequest`

| Field | Keterangan |
| --- | --- |
| `id`, `periodLockId` | Link ke kunci |
| `reason` | Wajib |
| `status` | `pending` \| `approved` \| `rejected` \| `cancelled` |
| `requiredRoles` | Role terdampak dihitung saat request dibuat (snapshot) |
| `approvals` | `ApprovalStamp[]` — satu stamp per role yang sudah setuju |
| `adminApproval?` | Stamp admin final (wajib sebelum `approved`) |
| `rejectedBy?`, `rejectReason?`, `createdAt`, `createdBy` | Audit |

**Role terdampak:** hitung dari transaksi bertanggal di `[startDate, endDate]` milik modul terkait:

| Sumber aktivitas | Role yang masuk `requiredRoles` |
| --- | --- |
| SO / retur jual / ship terkait | `penjualan` |
| PO / retur beli / receive terkait | `pembelian` |
| Batch / pack produksi | `produksi` |
| Mutasi stok gudang (bila bertanggal di periode) | `gudang` |
| Kas, biaya, payroll, jurnal, AR/AP bayar | `keuangan` |

- Role **tanpa** aktivitas di periode → **tidak** masuk `requiredRoles`, **tidak** ditampilkan di antrean approve.
- `admin` **tidak** dihitung sebagai “terdampak ops”; admin hanya langkah **final** setelah semua `requiredRoles` punya stamp.
- Jika `requiredRoles` kosong (tidak ada tx sama sekali) → cukup admin final + alasan.
- Satu user dengan role itu cukup (pola `upsertApproval` / `ApprovalStamp`).
- Reject oleh role terdampak atau admin → `rejected`; kunci tetap `active`.

### Gate

```
assertPeriodOpen(isoDate): string | undefined
```

- Return pesan error jika `isoDate` jatuh di kunci `active`; else `undefined`.
- Dipanggil **sebelum** mutasi di: ship/receive/void SO·PO, retur, biaya, payroll, kas in/out, jurnal manual, builder auto-journal, adj bank, dll. yang menulis tanggal dokumen.
- Gate sebelum mutasi → tidak ada half-post karena kunci (dual-track toast tidak dipakai untuk kasus kunci; error langsung ke user).

### Perilaku kunci

- UI: pilih bulan **atau** rentang → konfirm → `PeriodLock` aktif.
- Unlock **tidak** langsung: buat `UnlockRequest` → approve role terdampak (hanya yang di list) → admin final → set `active=false` + `unlockHistory` + clear `pendingUnlockRequestId`.
- Setelah unlock, post ke tanggal itu boleh lagi.
- Laporan: filter periode tetap; kunci tidak mengubah angka historis, hanya memblokir tulis baru.

---

## Persistence — `egabah.bank.v1`

### `BankSession`

| Field | Keterangan |
| --- | --- |
| `id` | Id sesi |
| `startDate`, `endDate` | Rentang statement |
| `cashAccountId` | Dari `AccountMap.cash` (snapshot saat buat) |
| `statementBalance?` | Saldo akhir dari CSV / input user (opsional ringkas) |
| `createdAt`, `createdBy`, `status` | `open` \| `closed` |

### `BankLine`

| Field | Keterangan |
| --- | --- |
| `id`, `sessionId` | |
| `date` | YYYY-MM-DD |
| `memo` / deskripsi | String |
| `amount` | Bertanda: + masuk, − keluar (atau normalisasi dari debit/kredit) |
| `bankRef?` | Ref opsional dari CSV |
| `status` | `unmatched` \| `matched` \| `ignored` \| `adjusted` |
| `cashEntryId?` | Match ke kas |
| `journalSourceKey?` | Opsional mirror JE kas / adj |
| `suggestedCashEntryId?` | Hasil auto-match menunggu terima/tolak |

### CSV

- Kolom minimal didokumentasikan di UI: tanggal, deskripsi, jumlah (+/− **atau** debit & kredit), ref opsional.
- Bukan sertifikasi format bank tertentu; parser toleran header umum.

### Matching

1. **Auto-match:** `BankLine` ↔ `cashEntries` belum matched: **jumlah exact** (rupiah) + tanggal dalam **±2 hari**. Usulkan `suggestedCashEntryId`; user terima/tolak.
2. **Manual match** ke `cashEntryId` pilihan.
3. **Abaikan** → `ignored`.
4. **Penyesuaian:** unmatched yang user setujui → `postJournal` dengan `sourceKey` `bank:{sessionId}:adj:{lineId}`; tipikal Dr/Cr `cash` vs `expenseOps` atau akun seed **`bankSuspense`** (AccountMap key baru). Status line → `adjusted`. Gate `assertPeriodOpen(line.date)` berlaku.
5. Ringkas sesi: matched count, unmatched, ignored, adjusted; selisih vs saldo buku kas (dari GL / cash balance di rentang — implementasi detail di plan).

### AccountMap

Seed COA + map key: `bankSuspense` (aset/liability penampung selisih rekon). UI AccountMap menambah label kunci ini.

---

## UI & peran

| Layar | Isi | Peran |
| --- | --- | --- |
| `/app/keuangan/periode` | List kunci, buat kunci bulan/range, buat unlock request, antrean approve (hanya role di `requiredRoles` + admin final), riwayat | lihat: keuangan\|admin (+ role terdampak lihat request mereka); kunci: keuangan\|admin |
| `/app/keuangan/rekon-bank` | Sesi, upload CSV, auto-match, manual/ignore, post adj, ringkas | keuangan\|admin |
| AccountMap | Key `bankSuspense` | keuangan\|admin |

Nav keuangan: item Periode + Rekon bank.

## DOMAIN

Dokumentasikan `PeriodLock`, `UnlockRequest` + aturan role terdampak, `BankSession`/`BankLine`, aturan match ±2d exact amount, `sourceKey` adj, AccountMap `bankSuspense`, dan daftar call-site `assertPeriodOpen`.

## Verifikasi

1. `npx tsc -p tsconfig.app.json --noEmit`
2. Kunci bulan → ship/receive/biaya/kas/jurnal bertanggal di bulan itu **ditolak** dengan pesan jelas; tanggal di luar kunci tetap boleh
3. Unlock request: hanya role dengan tx di periode muncul; role lain tidak ditanya; setelah semua + admin → post boleh lagi; reject → kunci tetap aktif
4. Overlap kunci ditolak
5. CSV → auto-match saran → terima → matched; manual / ignore; adj JE `bank:…:adj:…` muncul di Jurnal
6. Dual-track toast tetap jika jurnal adj gagal (ops/kas match sudah tersimpan terpisah dari JE bila applicable); kunci selalu gate sebelum mutasi

## Out of scope (2c)

- API / OFX / feed bank nyata
- Multi-rekening bank
- Kunci otomatis tiap akhir bulan tanpa aksi user
- Unlock tanpa admin final / soft unlock langsung tanpa approve
- Rekon langsung ke AP/AR tanpa lewat kas
- Backfill kunci/rekon historis otomatis
- Vitest baru (kecuali sudah ada di repo)

## Handoff berikutnya

Setelah 2c stabil: persistensi cloud / DB (roadmap), atau polish UX periode/rekon sesuai feedback.
