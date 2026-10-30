# Spek: Supabase fondasi — Master + RBAC (gelombang DB-A)

Tanggal: 2026-10-30  
Status: approved (user: pendekatan 1 + Master/RBAC + alur data)  
Pra-syarat: fitur operasional (s.d. 2c) masih localStorage; spek ini hanya memindahkan **auth + master** ke cloud.

## Tujuan

Menghubungkan E-Gabah ke project Supabase `ulhcvbnsfikycffvycxa` dengan:

1. Auth sungguhan (`signInWithPassword`) mengganti `demo-users.ts` bila env tersedia.
2. Persistensi Master (mitra, produk, pengguna/`profiles`) di Postgres + **RLS** untuk uji RBAC.
3. Fallback localStorage bila env kosong / offline, agar dev tanpa cloud tetap jalan.
4. Env Cloudinary disiapkan untuk upload gambar nanti; **bukan** fitur upload di gelombang ini.

## Keputusan desain (brainstorm)

| Topik | Pilihan |
| --- | --- |
| Cakupan gelombang | Fondasi A: Auth + Master saja (modul lain tetap local) |
| Pendekatan | **1 — Tabel + RLS** (bukan snapshot JSON) |
| Modul pertama | Master (mitra, produk, pengguna) + RBAC |
| Client env | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (bukan connection string Postgres) |
| Postgres URL / password | Hanya SQL Editor / migrasi / CLI — tidak di Vite |
| Fallback | localStorage `egabah.master.v1` + demo auth jika cloud tidak dikonfigurasi |
| Cloudinary | Env saja (`cloud name` `pqkoa1lc` + unsigned preset); upload UI di spek terpisah |
| UI Master | Tidak dirombak; ganti body repository + AuthContext |

## Pendekatan (ringkas)

Adapter tipis di atas interface yang sudah ada:

- `src/lib/supabase-client.ts` — `createClient` jika kedua env ada; else `null`.
- Auth: jika client ada → Supabase Auth + baca `profiles`; else → `demo-users` seperti sekarang.
- Master: jika client + session → `select`/`upsert`/`delete` ke `partners`, `products`, `profiles`; else → `masterRepository` localStorage.
- Bentuk memori UI tetap `MasterSnapshot` agar `master-store` / halaman tidak berubah besar.
- RBAC dua lapis: React (`RequireRole` / `canAccessPath`, master routes sudah `admin`) + RLS Postgres (sumber kebenaran API).

---

## Arsitektur

```
LoginPage → AuthContext
              ├─ (cloud) supabase.auth + profiles.role
              └─ (lokal)  demo-users

Master pages → master-store → masterRepository
                                 ├─ (cloud) supabase tables + RLS
                                 └─ (lokal)  egabah.master.v1
```

Tidak ada Edge Function di gelombang ini. Semua lewat anon key + RLS.

---

## Skema Postgres

### Enum / check

- `user_role`: `admin` | `pembelian` | `produksi` | `gudang` | `penjualan` | `keuangan` (selaras `UserRole`)
- `partner_kind`: `supplier` | `customer`
- `product_category`: `gabah` | `beras` | `sampingan`

### `profiles`

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid PK | = `auth.users.id` |
| `email` | text | unik, dinormalisasi lower |
| `name` | text | |
| `role` | user_role | default bukan admin kecuali seed |
| `title`, `phone`, `branch`, `department` | text | default `''` |
| `active` | boolean | default true |
| `created_at`, `updated_at` | timestamptz | |

Trigger opsional: setelah `auth.users` insert, buat baris `profiles` minimal (role `pembelian` / pending) — seed demo mengisi role eksplisit.

### `partners`

Kolom 1:1 dengan `MasterPartner` (`kind`, `name`, `legal_name`, … `active`, `note`). PK `id` text (pertahankan id seed `SUP-…` / `CUS-…` agar lookup modul lokal lain tidak pecah di gelombang ini).

### `products`

Kolom 1:1 dengan `MasterProduct`. PK `id` text; `sku` unik.

Indeks: `partners(kind)`, `products(sku)`, `profiles(role)`, `profiles(email)`.

---

## RLS (gelombang 1)

Helper SQL: `auth_is_admin()` → `exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.active)`.

| Tabel | SELECT | INSERT/UPDATE/DELETE |
| --- | --- | --- |
| `profiles` | authenticated: baris sendiri **atau** admin lihat semua | **hanya admin** (gelombang 1; self-edit non-role ditunda) |
| `partners` | authenticated | hanya admin |
| `products` | authenticated | hanya admin |

Catatan uji RBAC: login non-admin → `select` produk/mitra OK lewat API; tulis ditolak. Halaman Master di UI tetap hanya `admin` via `RequireRole` — untuk uji RLS langsung, pakai SQL/REST atau role sementara di nav (bukan syarat spek).

---

## Auth & seed

1. Buat 6 user Auth (email demo yang sama: `admin@egabah.local`, …) password awal `demo123` (ganti di production).
2. Insert `profiles` matching `auth.users.id` + role/name dari `DEMO_ACCOUNTS` / `SEED_USERS`.
3. Upsert seed `partners` + `products` dari `master-data.ts`.
4. Dokumentasikan langkah seed di spek/plan (SQL + Auth dashboard atau script one-shot); jangan commit service role key.

Login gagal / `profiles.active = false` → tolak masuk dengan pesan jelas.

---

## Repository & sync

- `masterRepository.load` / `save` menjadi async-capable **atau** wrapper sync yang memuat cache + `refreshFromCloud()` di store mount (pilih satu di plan; prefer **async load di store** dengan loading state ringan agar tidak membohongi sync API).
- Preferensi implementasi: `loadCloud(): Promise<MasterSnapshot>`, `saveCloud(snapshot | patches)`; store memakai itu jika `isSupabaseConfigured()`.
- Simpan: diff sederhana atau full upsert per koleksi (mitra/produk) — full upsert per save Master di MVP boleh; dokumentasikan batas ukuran.
- `users` di snapshot berasal dari `profiles` (map ke `MasterUser`); create user baru di UI Master gelombang 1 = **update profile yang sudah ada di Auth**, bukan sign-up massal dari browser (sign-up admin-only lewat dashboard / nanti Edge Function).

Realtime: **tidak** di gelombang ini. Multi-tab cloud = refresh manual / remount.

---

## Env & Cloudinary

File lokal: `.env.local` (gitignored). Template: `.env.example`.

| Variabel | Dipakai Vite? | Keterangan |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | ya | `https://ulhcvbnsfikycffvycxa.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ya | anon public |
| `VITE_CLOUDINARY_CLOUD_NAME` | ya | `pqkoa1lc` |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | ya | unsigned preset (isi manual) |
| `VITE_CLOUDINARY_FOLDER` | ya | default `egabah` |
| `CLOUDINARY_URL` / API key | tidak | server/CLI saja; secret tidak di `VITE_*` |

Gelombang ini **tidak** mengirim file ke Cloudinary. Kolom `image_url` pada produk/mitra **ditunda** spek media.

---

## Error handling

| Situasi | Perilaku |
| --- | --- |
| Env Supabase kosong | Mode lokal (demo auth + localStorage); tanpa noise |
| Network / 5xx | Toast gagal; pertahankan cache UI terakhir; jangan corrupt local seed diam-diam |
| RLS deny (42501) | Toast “Tidak punya izin”; batalkan mutasi optimistik |
| Session expired | Redirect login |
| Cloudinary env kosong | Tidak relevan sampai spek upload |

---

## Testing / verifikasi manual

1. Tanpa `.env.local` → login demo + Master local seperti sekarang.
2. Dengan env + seed → login `admin@egabah.local` → CRUD mitra/produk tersimpan di Supabase (cek Table Editor).
3. Login role non-admin → tidak masuk route Master (React); REST `update products` dengan JWT user itu → ditolak RLS.
4. Login admin → ubah `profiles.role` user lain → setelah re-login, nav mengikuti role baru.
5. Pastikan `.env.local` tidak masuk `git status` staged.

---

## Di luar cakupan

- Persediaan / pembelian / penjualan / keuangan / payroll ke Supabase
- Realtime, Edge Functions, service role di client
- Upload Cloudinary & field gambar
- Invite/sign-up self-serve
- Migrasi data localStorage user production (belum ada prod)

## Sukses gelombang

Admin cloud dapat mengelola master di DB; role terbaca dari `profiles`; RLS menolak tulis non-admin; lokal tanpa env tetap usable.
