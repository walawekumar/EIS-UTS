# Spek: Normalisasi relasional penuh — semua modul ops

Tanggal: 2026-10-30  
Status: approved intent (user: relasional penuh + semua modul sekaligus)  
Menggantikan pendekatan `ops_docs` (1 baris = 1 dokumen JSONB) untuk data operasional.

## Tujuan

- Semua data modul ops ada di **tabel domain terpisah** (kolom typed), pola sama dengan `stock_*` / master.
- UI / Context / aturan bisnis **tidak berubah**; hanya lapisan persistensi + migrasi DB.
- Setelah migrasi data sukses: **drop** `ops_docs` (dan hapus path kode terkait). `app_module_snapshots` sudah kosong — drop juga jika masih ada.

## Non-tujuan (gelombang ini)

- Tidak membangun tabel ACL halaman terpisah (role tetap di `profiles` + nav React + `auth_can_write_module`).
- Tidak menambah hard FK ke `products`/`partners` sampai data bersih (pakai soft FK text dulu).
- Tidak mengubah alur multiuser/realtime di luar yang diperlukan agar CRUD baru jalan.
- Tidak redesign domain (stage, approval, tax) — hanya memetakan tipe TS → kolom/tabel.

## Keputusan arsitektur

| Aspek | Keputusan |
| --- | --- |
| Bentuk | Relasional penuh: 1 entitas header = 1 tabel; nested array penting = tabel anak |
| Approval stamp / blob kecil | Kolom `jsonb` di header (hindari ledakan tabel) |
| Audit `before`/`after` | `jsonb` di `audit_logs` |
| ID | `text` PK = id yang dipakai app hari ini |
| Soft FK | `supplier_id`, `customer_id`, `sku`, `lot_id`, `account_id`, dll. sebagai `text` + index |
| RLS write | `auth_can_write_module('<module>')` per kelompok tabel |
| RLS select | `authenticated` (sama pola ops_docs / stock) |
| App adapter | Repository per modul baca/tulis Supabase table (bukan `ops_docs`); hydrate gate diganti |
| Migrasi | Satu (atau berantai) migration SQL: create → copy dari `ops_docs.doc` → verify → drop `ops_docs` |
| Rollback | Simpan dump `ops_docs` sebelum drop; jangan drop di production tanpa count-check |

## Inventaris tabel target

Prefix tidak dipaksakan; nama mengikuti bahasa domain app (snake_case).

### Pembelian (`auth_can_write_module('pembelian')`)

| Tabel | Sumber `ops_docs` | Catatan |
| --- | --- | --- |
| `purchases` | `pembelian/purchases` | Header PO/lot; tax snapshot = kolom atau jsonb kecil |
| `purchase_payments` | nested `payments[]` | FK soft `purchase_id` |
| `purchase_returns` | `pembelian/returns` | |
| `purchase_return_lines` | nested `lines[]` | |
| `lot_qc` | `pembelian/lot_qc` | PK = `lot_id` (atau `id` = lotId) |

### Penjualan (`penjualan`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `sale_orders` | `penjualan/orders` | Single-SKU di header (sesuai model sekarang) |
| `sale_order_payments` | nested `payments[]` | |
| `sale_returns` | `penjualan/returns` | |
| `sale_return_lines` | nested `lines[]` | |

### Produksi (`produksi`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `production_batches` | `produksi/batches` | Input di header |
| `batch_outputs` | nested `outputs[]` | |
| `pack_runs` | `produksi/pack_runs` | |
| `pack_run_lines` | nested `lines[]` | |
| `lot_costs` | `produksi/lot_costs` | PK `lot_id` |

### Keuangan (`keuangan`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `cash_entries` | `keuangan/cash_entries` | Flat |
| `payables` | `keuangan/payables` | `supplier` name text (model sekarang) |
| `receivables` | `keuangan/receivables` | `customer` name text |
| `expenses` | `keuangan/expenses` | |

### Period (`period`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `period_locks` | `period/locks` | `unlock_history` → jsonb |
| `period_unlock_requests` | `period/unlock_requests` | `approvals` / `admin_approval` → jsonb |

### Bank (`bank`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `bank_sessions` | `bank/sessions` | |
| `bank_lines` | `bank/lines` | Sudah collection terpisah; `session_id` index |

### Tax (`tax`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `tax_settings` | `tax/settings` | Singleton row `id = 'settings'` |
| `tax_docs` | `tax/docs` | Polymorphic soft FK `source_type` + `source_id` |
| `tax_invoices` | `tax/invoices` | |

### GL (`gl`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `gl_accounts` | `gl/accounts` | `parent_id` self-ref soft |
| `gl_account_map` | `gl/account_map` | Singleton `id = 'map'` + `value jsonb`, atau key-value rows — **pilih singleton jsonb** agar 1:1 dengan app |
| `gl_journals` | `gl/journals` | |
| `gl_journal_lines` | nested `lines[]` | Wajib dinormalisasi |
| `gl_failed_posts` | `gl/failed_posts` | PK = `source_key`; payload journal → jsonb (dead-letter) |

### Payroll (`payroll`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `payroll_runs` | `payroll/runs` | `approvals` → jsonb |
| `payroll_lines` | nested `lines[]` | `user_id` soft → profiles |

### Audit (`audit`)

| Tabel | Sumber | Catatan |
| --- | --- | --- |
| `audit_logs` | `audit/logs` | `before`/`after` jsonb; append-oriented |

**Perkiraan:** ~30 tabel (termasuk child). Enum stage/status dibuat hanya jika sudah stabil di TS; selain itu `text` + check longgar.

## Pemetaan kolom (prinsip)

1. Field skalar di tipe TS → kolom typed (`text`, `numeric`, `boolean`, `timestamptz`, `date`/`text` tanggal label mengikuti app).
2. Object opsional kecil (`weighing`, `delivery`, tax snapshot) → **satu kolom jsonb** kecuali sering di-filter (maka promote ke kolom).
3. Array domain (`payments`, `lines`, `outputs`) → tabel anak dengan `parent_id` + `id` baris.
4. Nama kolom snake_case di Postgres; mapper TS di repository menjaga camelCase ke Context.

## Alur data app

```
Feature Context  →  *-storage repository  →  Supabase table CRUD
Boot: OpsCloudGate (atau pengganti) hydrate semua tabel relevan → cache lokal / set state
Persist: write-through + error bus (pola cloud-persist-bus yang ada)
Logout/unload: flush pending (sama AuthContext hari ini)
```

- Hapus ketergantungan runtime ke `cloud-ops-docs`, `ops-docs-backed-repository`.
- `createCloudBackedRepository` / `app_module_snapshots` path: hapus jika sudah mati.
- Master & persediaan **tidak disentuh**.

## Migrasi DB (urutan)

1. `CREATE TABLE` + index + RLS untuk semua tabel target.
2. `INSERT … SELECT` dari `ops_docs` dengan `jsonb` path per collection (termasuk unnest child arrays).
3. Verifikasi: count per collection lama vs count tabel baru; spot-check id.
4. `DROP TABLE ops_docs` (+ policies); drop `app_module_snapshots` jika masih ada.
5. Deploy app yang memakai tabel baru **setelah** step 2–3 (atau feature-flag singkat: dual-read tidak diperlukan jika cutover satu deploy).

Cutover: **big bang** sesuai pilihan user (semua modul sekaligus). Staging: jalankan migrasi di Supabase project, smoke login + CRUD satu dokumen per modul, baru merge.

## RLS template (per tabel modul `M`)

```sql
alter table public.<t> enable row level security;
create policy <t>_select on public.<t> for select to authenticated using (true);
create policy <t>_insert on public.<t> for insert to authenticated
  with check (public.auth_can_write_module('M'));
create policy <t>_update on public.<t> for update to authenticated
  using (public.auth_can_write_module('M'))
  with check (public.auth_can_write_module('M'));
create policy <t>_delete on public.<t> for delete to authenticated
  using (public.auth_can_write_module('M'));
```

Child tables memakai module key parent yang sama.

## Testing / verifikasi

- `npx tsc -p tsconfig.app.json --noEmit`
- SQL: counts `ops_docs` (sebelum drop) vs tabel baru
- Smoke: login role terkait → create/update 1 row di pembelian, penjualan, produksi, keuangan, GL journal+lines
- RLS negatif: role salah tidak bisa insert modul asing (pola smoke sebelumnya)

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Shape jsonb tidak seragam | Migrasi defensive (`coalesce`, skip id kosong); log row gagal |
| Cutover besar | Dump `ops_docs` dulu; migrasi idempotent `on conflict` |
| Mapper camelCase/snake | Satu helper map per modul, uji dengan fixture dari dump |
| Child orphan | Delete parent cascade di app (urutan delete) atau `on delete cascade` di FK soft parent_id |

## Urutan implementasi (plan berikutnya)

1. Spek ini di-review user → writing-plans (task breakdown).
2. Migration SQL create + copy + RLS.
3. Lib repository relasional generik (atau per-modul thin wrappers).
4. Wire semua `*-storage.ts` + gate hydrate.
5. Apply migrasi Supabase → verify counts → drop `ops_docs`.
6. Hapus kode mati ops_docs/snapshot; `tsc` + smoke.

## Relasi ke spek lama

- `2026-10-30-ops-docs-normalize-design.md` = gelombang dokumen JSONB (selesai sebagai batu loncatan).
- Spek ini = **langkah normalisasi sebenarnya** (tabel domain).
