# Cloud smoke + hardening notes

Tanggal: 2026-10-30

## Apakah tabel sudah semua?

**Belum dinormalisasi penuh.**

| Lapisan | Bentuk | Tabel |
| --- | --- | --- |
| Auth/Master | Relasional | `profiles`, `partners`, `products` |
| Persediaan | Relasional | `stock_balances`, `stock_movements`, `stock_corrections` |
| Ops (10 modul) | **JSONB singleton** | `app_module_snapshots` (`pembelian`…`audit`) |

Normalisasi PO/SO/batch/kas → tabel terpisah = gelombang **setelah** hardening.

## Smoke (bukti)

- `tsc` exit 0; `npm run build` exit 0
- DB: 7 tabel public di atas; snapshots 10 keys
- Auth admin + gudang login OK
- SELECT partners/products/stock/snapshots OK
- WRITE stock admin/gudang OK
- RLS partners: gudang **tidak** mengubah `sup-01.note` (id seed lowercase `sup-01`, bukan `SUP-001`)

## Hardening (branch `fix/cloud-hardening`)

- Banner error persist cloud + dismiss
- Jangan overwrite remote jika hydrate gagal
- Optimistic concurrency snapshot via `updated_at`
- Flush pending saves on `beforeunload` / logout
- `onAuthStateChange` SIGNED_OUT / TOKEN_REFRESHED
