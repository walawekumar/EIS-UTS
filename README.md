# E-Gabah

ERP berbasis web untuk usaha penggilingan padi (proyek EIS).

## Stack

- Vite + React + TypeScript
- React Router
- Tailwind CSS v4

## Menjalankan lokal

```bash
npm install
npm run dev
```

## Alur MVP saat ini

1. `/login` — autentikasi mock + pilih peran RBAC
2. `/portal` — hub modul (mirip portal SSO)
3. `/app/*` — halaman modul (shell + placeholder)

Auth masih disimpan di `localStorage`. Siap diganti Supabase Auth nanti.

## Modul

Dashboard, Master Data, Pembelian, Persediaan, Produksi, Penjualan, Keuangan.
