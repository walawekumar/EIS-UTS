# Spek: Alur mengikat dual-approve + responsive (pra-backend)

Tanggal: 2026-10-30  
Status: approved (user: acc semua + responsive whole-app)

## Tujuan

Mengikat modul operasional dengan kontrol Keuangan/Admin sebelum uang cair atau pembelian selesai, dengan bukti lampiran, validasi input, UX tabel seragam, dan seluruh app usable di mobile/desktop.

## Pendekatan

Shared approval helper + stage machine per modul (bukan antrian terpusat, bukan hardcode role if tersebar tanpa tipe).

## Shared primitives

### `ApprovalStamp`

```ts
type ApprovalStamp = {
  role: 'admin' | 'keuangan' | 'pembelian' | 'penjualan' | 'produksi' | 'gudang'
  by: string      // nama aktor
  at: string      // ISO
  note?: string
}
```

Helper murni di `src/features/workflow/approvals.ts`:

- `hasApproval(list, role)`
- `upsertApproval(list, stamp)`
- `clearApprovals(list)` (saat edit draft material yang reset gate)

### Bukti (`ProofAttachment`)

Reuse `ReceiptUpload` → simpan `{ name, size, previewUrl?, mime }` dan/atau `receiptName` string untuk print.

Jenis bukti yang dipakai:

| Konteks | Field | Wajib |
| --- | --- | --- |
| Ajukan ke keuangan | `invoiceProof` (invoice / penawaran / proforma dari pemasok) | Ya saat `draft` → `diajukan` — supaya keuangan tahu nilai & isi sebelum approve |
| Terima/beli barang | `purchaseProof` (struk beli final) | Ya sebelum keuangan `selesai` |
| Transfer/mutasi bayar AP | `transferProof` | Ya saat bayar / cair |
| Payroll cair | `transferProof` | Ya saat post/cair |
| Timbang (sudah ada) | `weighing.receiptName` | Tetap |

Catatan: `invoiceProof` ≠ `purchaseProof`. Invoice diajukan di awal (estimasi/tagihan pemasok); struk beli dilampirkan setelah barang diterima.

### Keamanan input (form kritis)

- Nominal: `parseIdrInput` → harus `> 0` bila field wajib; tampilkan preview `formatIdr`.
- Alasan reject/void: `PromptDialog` wajib non-kosong.
- Bukti: blok aksi jika flag settings / stage mewajibkan dan lampiran kosong.
- Setelah `posted` / `selesai` / `void`: field **read-only abu-abu** (`TextField` locked).
- Role gate **aksi** (bukan hanya path): cek `user.role` di handler store/UI sebelum mutasi stage.

## A. Pembelian ↔ Keuangan

### Stage baru (mengganti/memperluas string lama)

Migrasi kompatibel dari stage lama:

| Lama | Baru |
| --- | --- |
| `dicatat` | `diajukan` (siap antre approve; edit material mengembalikan ke `draft`) |
| `ditimbang` | `ditimbang` (hanya setelah `disetujui`) |
| `diterima` | `selesai` (migrasi: dokumen lama dianggap sudah complete) |

Stage tambahan baru: `draft`, `disetujui`, `ditolak`, `menunggu_selesai`.

**Mesin status:**

```
draft → diajukan → disetujui → ditimbang → menunggu_selesai → selesai
                 ↘ ditolak (boleh edit → kembali draft → ajukan ulang)
void: dari ditimbang | menunggu_selesai | selesai (admin|keuangan + alasan)
```

### Hak aksi

| Aksi | Peran |
| --- | --- |
| Buat / edit draft | `pembelian`, `admin` |
| Ajukan (wajib `invoiceProof` + ringkasan nilai) | `pembelian`, `admin` — tanpa invoice → blok + error jelas |
| Approve / tolak anggaran (lihat invoice di drawer) | `keuangan`, `admin` |
| Timbang + upload bukti timbang | `pembelian`, `admin` |
| Konfirmasi terima + upload struk beli | `pembelian`, `admin` → status `menunggu_selesai` |
| Nyatakan selesai (+ cek bukti, opsional bukti transfer jika lunas) | `keuangan`, `admin` |
| Bayar utang (AP) + bukti transfer | `keuangan`, `admin` (pembelian boleh ajukan bukti, keuangan konfirm) |
| Void | `keuangan`, `admin` |

### Efek silang

- Ajukan: wajib lampiran `invoiceProof` (nama file + preview lokal). Keuangan membuka drawer dan melihat invoice sebelum approve/tolak.
- Approve: **belum** buat AP/stok.
- Konfirmasi terima (`menunggu_selesai`): stok in + `upsertPayable` (seperti `confirmWeighing` sekarang), tapi kas/lunas belum final sampai keuangan `selesai` bila ada settlement tunai.
- `selesai`: kunci dokumen; bayar AP boleh paralel setelah payable ada, wajib `transferProof` saat `applyPurchasePayment`.
- Tanpa `disetujui`: tombol timbang/terima/bayar disabled + toast jelas.

### UI

- Badge stage + chip “Menunggu approve keuangan” / “Menunggu selesai keuangan”.
- Notifikasi in-app (reuse `build-notifications`) untuk draft menunggu approve / menunggu selesai.
- Detail drawer: timeline approvals + lampiran bukti.

## B. Payroll dual-approve + cair

### Status

```
draft → menunggu_approve → siap_cair → posted → void
```

- Dari `draft`, setelah submit (atau auto saat “Ajukan approve”): `menunggu_approve`.
- `siap_cair` hanya jika `hasApproval(admin)` **dan** `hasApproval(keuangan)` (urutan bebas).
- `posted` = uang cair: `addCashEntry` out + wajib `transferProof` + catatan mutasi opsional.
- Edit material (ubah baris gaji) di `menunggu_approve` → reset approvals ke `draft` / `menunggu_approve` tanpa stamp (konfirmasi custom dialog).

### Hak aksi

| Aksi | Peran |
| --- | --- |
| Buat / edit draft | `admin`, `keuangan` |
| Approve sebagai Admin | `admin` |
| Approve sebagai Keuangan | `keuangan` (admin **tidak** mengisi kedua stamp sendirian — admin hanya stamp `admin`; keuangan stamp `keuangan`. Jika user adalah admin yang juga ingin mewakili keuangan: **tidak** — butuh dua peran terpisah. Demo: login berganti user.) |
| Cairkan (post) | `keuangan`, `admin` hanya jika `siap_cair` + bukti |
| Void | `admin`, `keuangan` |

Clarifikasi anti-ambigu: **satu akun admin tidak boleh double-stamp** sebagai keuangan. Dual control butuh dua aktor/peran berbeda.

### UI Payroll

- FinanceFilterBar (search, filter status/periode), sort, pager.
- Drawer: edit baris (draft), panel approve (dua tombol sesuai role), upload bukti transfer sebelum cair.
- Locked fields setelah `posted`/`void`.

## C. Tabel & filter seragam

Setiap list operasional wajib punya (pola Kas/Utang):

- Search
- Filter status (minimal)
- Sort kolom utama
- Pager (`usePageSize`)

Gap eksplisit ditutup: **PayrollPage**. Audit/Laporan/Dashboard: search/filter hanya jika ada tabel data (Dashboard aktivitas sudah punya; Laporan cukup filter periode).

## D. Responsive whole-app

Target: usable **320px – desktop** tanpa horizontal page-scroll (kecuali isi tabel yang `overflow-x-auto`).

### Shell

- Sidebar: drawer off-canvas di `< md`, hamburger di topbar; overlay tutup.
- Topbar: title truncate; aksi (notif, user) tetap terjangkau.
- Main padding: `px-3` mobile → `sm:px-5`.

### Komponen

- `DetailDrawer` / `FinanceModal`: full-sheet bottom di mobile (sudah sebagian), pastikan footer sticky & tidak terpotong keyboard.
- Filter bar: stack vertikal di mobile (`flex-col`), kontrol full-width.
- Stat grid: 1 kolom mobile → 2/3 desktop.
- Tabel: `min-w` + `overflow-x-auto`; kolom aksi sticky kanan bila memungkinkan (nice-to-have, bukan blocker).
- Module tabs / subnav: scroll-x chip, tidak wrap berlebih.
- Touch: target ≥ 40px untuk aksi utama.

### Halaman yang wajib dicek

Login, Dashboard, semua modul nav (Pembelian, Persediaan, Produksi, Penjualan, Keuangan+Payroll, Master, Audit, Laporan, Settings).

## E. Out of scope gelombang ini

- Backend/Supabase, RLS cloud, e-mail notifikasi.
- Dual-approve penjualan (bisa fase berikutnya dengan pola sama).
- Antrian approve terpusat (inbox global) — cukup filter “menunggu saya” di halaman modul + notifikasi.
- PDF bank statement OCR.

## F. Migrasi data lokal

- Seed & localStorage: map stage lama → baru saat load repository (fungsi `migratePurchaseStage` / `migratePayrollStatus`).
- Dokumen `diterima` lama → `selesai` (anggap sudah complete) agar demo tidak macet.
- Payroll `posted` lama tetap `posted` dengan approvals sintetis (admin+keuangan) agar konsisten.

## G. DOMAIN.md

Update status mesin Pembelian & Payroll + aturan dual-stamp + bukti wajib.

## H. Acceptance criteria

1. PO tidak bisa ditimbang/diterima sebelum status `disetujui` (approve oleh `keuangan` atau `admin`).
1b. PO tidak bisa `diajukan` tanpa `invoiceProof`; keuangan melihat invoice sebelum approve.
2. Keuangan tidak bisa `selesai` tanpa struk beli (`purchaseProof`) terunggah.
3. Pembayaran AP / cair payroll menolak tanpa bukti transfer (dialog custom, bukan native).
4. Payroll cair hanya setelah stamp `admin` **dan** `keuangan` dari dua peran berbeda (satu user admin tidak double-stamp).
5. Payroll list punya search/filter/sort/pager.
6. Di viewport 375px: shell navigable (drawer), form utama usable, tabel scroll horizontal lokal saja.
7. `tsc --noEmit` bersih; tidak ada `window.confirm/prompt/alert` baru.
