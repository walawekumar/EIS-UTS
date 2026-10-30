# Domain E-Gabah (pra-backend)

Sumber kebenaran tipe: `src/features/*/ *-data.ts`. Dokumen ini merangkum entitas, status, dan efek silang modul.

## Entitas inti

| Entitas | Modul | Key storage |
| --- | --- | --- |
| Partner (pemasok/pelanggan) | Master | `egabah.master.v1` |
| Produk / SKU | Master | ↑ |
| Pengguna & peran | Master | ↑ |
| Purchase | Pembelian | `egabah.pembelian.v1` |
| SaleOrder | Penjualan | `egabah.penjualan.v1` |
| Stock / Movement / Correction | Persediaan | `egabah.persediaan.v1` |
| Batch (giling) | Produksi | `egabah.produksi.v1` |
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

- Void setelah dikirim: reverse stok + hapus AR tertaut (`voidedAt`).
- Hard-delete hanya tahap awal (`dibuat`).
- Limit kredit pelanggan dicek saat kirim dengan settlement `kredit`.

## Produksi — struktur batch

- Input: 1 baris gabah (`sku`, `qty`, `fromLocation`)
- Output: N baris (beras / menir / dedak / sekam)
- Rendemen aktual = `(qty beras / qty input) * 100`
- Neraca massa = `sum(output) - input` (toleransi dari settings bila ada)

## Audit

Setiap aksi domain menulis `AuditLog`: `{ id, at, actor, action, entity, entityId, before?, after?, note? }`.

## Sync (pra-cloud)

`syncBus` lokal: `BroadcastChannel('egabah-sync')` untuk multi-tab. Diganti Realtime Supabase / Firestore listener tanpa mengubah UI.
