export type ModuleCategory =
  | 'semua'
  | 'operasional'
  | 'produksi'
  | 'keuangan'
  | 'master'
  | 'lainnya'

export type AppModule = {
  id: string
  title: string
  description: string
  path: string
  category: Exclude<ModuleCategory, 'semua'>
  accent: string
  icon: 'dashboard' | 'master' | 'buy' | 'stock' | 'mill' | 'sell' | 'finance'
}

export const MODULE_CATEGORIES: { id: ModuleCategory; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'operasional', label: 'Operasional' },
  { id: 'produksi', label: 'Produksi' },
  { id: 'keuangan', label: 'Keuangan' },
  { id: 'master', label: 'Master Data' },
  { id: 'lainnya', label: 'Lainnya' },
]

export const APP_MODULES: AppModule[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Ringkasan stok, produksi, dan keuangan',
    path: '/app/dashboard',
    category: 'lainnya',
    accent: '#1b6b43',
    icon: 'dashboard',
  },
  {
    id: 'master',
    title: 'Master Data',
    description: 'Pemasok, pelanggan, produk, dan satuan',
    path: '/app/master-data',
    category: 'master',
    accent: '#0f766e',
    icon: 'master',
  },
  {
    id: 'pembelian',
    title: 'Pembelian',
    description: 'Pembelian dan penerimaan gabah',
    path: '/app/pembelian',
    category: 'operasional',
    accent: '#3f7d2e',
    icon: 'buy',
  },
  {
    id: 'persediaan',
    title: 'Persediaan',
    description: 'Saldo dan mutasi bahan baku serta produk',
    path: '/app/persediaan',
    category: 'operasional',
    accent: '#4d7c0f',
    icon: 'stock',
  },
  {
    id: 'produksi',
    title: 'Produksi',
    description: 'Batch giling multi-output dan rendemen',
    path: '/app/produksi',
    category: 'produksi',
    accent: '#a16207',
    icon: 'mill',
  },
  {
    id: 'penjualan',
    title: 'Penjualan',
    description: 'Penjualan, pengiriman, dan tagihan',
    path: '/app/penjualan',
    category: 'operasional',
    accent: '#047857',
    icon: 'sell',
  },
  {
    id: 'keuangan',
    title: 'Keuangan',
    description: 'Kas, utang, piutang, dan biaya dasar',
    path: '/app/keuangan',
    category: 'keuangan',
    accent: '#14532d',
    icon: 'finance',
  },
]
