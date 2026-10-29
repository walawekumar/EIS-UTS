import type { UserRole } from '@/types/auth'

export type NavItem = {
  id: string
  label: string
  path: string
  roles: UserRole[]
}

export type NavGroup = {
  id: string
  label: string | null
  items: NavItem[]
}

/** Menu ketat per peran — grup induk + sub-menu operasional */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: null,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/app/dashboard',
        roles: ['admin', 'pembelian', 'produksi', 'gudang', 'penjualan', 'keuangan'],
      },
    ],
  },
  {
    id: 'pembelian',
    label: 'Pembelian',
    items: [
      {
        id: 'pembelian-pesanan',
        label: 'Pesanan Gabah',
        path: '/app/pembelian',
        roles: ['admin', 'pembelian'],
      },
      {
        id: 'pembelian-penerimaan',
        label: 'Penerimaan',
        path: '/app/pembelian/penerimaan',
        roles: ['admin', 'pembelian'],
      },
      {
        id: 'pembelian-utang',
        label: 'Utang Pemasok',
        path: '/app/pembelian/utang',
        roles: ['admin', 'pembelian'],
      },
    ],
  },
  {
    id: 'persediaan',
    label: 'Persediaan',
    items: [
      {
        id: 'stok-saldo',
        label: 'Saldo Stok',
        path: '/app/persediaan',
        roles: ['admin', 'gudang'],
      },
      {
        id: 'stok-mutasi',
        label: 'Mutasi',
        path: '/app/persediaan/mutasi',
        roles: ['admin', 'gudang'],
      },
      {
        id: 'stok-koreksi',
        label: 'Koreksi',
        path: '/app/persediaan/koreksi',
        roles: ['admin', 'gudang'],
      },
    ],
  },
  {
    id: 'produksi',
    label: 'Produksi',
    items: [
      {
        id: 'batch-list',
        label: 'Batch Giling',
        path: '/app/produksi',
        roles: ['admin', 'produksi'],
      },
      {
        id: 'batch-input',
        label: 'Input–Output',
        path: '/app/produksi/input-output',
        roles: ['admin', 'produksi'],
      },
      {
        id: 'batch-rendemen',
        label: 'Rendemen',
        path: '/app/produksi/rendemen',
        roles: ['admin', 'produksi'],
      },
    ],
  },
  {
    id: 'penjualan',
    label: 'Penjualan',
    items: [
      {
        id: 'penjualan-order',
        label: 'Order',
        path: '/app/penjualan',
        roles: ['admin', 'penjualan'],
      },
      {
        id: 'penjualan-kirim',
        label: 'Pengiriman',
        path: '/app/penjualan/pengiriman',
        roles: ['admin', 'penjualan'],
      },
      {
        id: 'penjualan-tagihan',
        label: 'Tagihan',
        path: '/app/penjualan/tagihan',
        roles: ['admin', 'penjualan'],
      },
    ],
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    items: [
      {
        id: 'kas',
        label: 'Kas',
        path: '/app/keuangan',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'utang',
        label: 'Utang Pemasok',
        path: '/app/keuangan/utang',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'piutang',
        label: 'Piutang Pelanggan',
        path: '/app/keuangan/piutang',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'biaya',
        label: 'Biaya Operasional',
        path: '/app/keuangan/biaya',
        roles: ['admin', 'keuangan'],
      },
    ],
  },
  {
    id: 'master',
    label: 'Master Data',
    items: [
      {
        id: 'master-mitra',
        label: 'Pemasok & Pelanggan',
        path: '/app/master-data',
        roles: ['admin'],
      },
      {
        id: 'master-produk',
        label: 'Produk & Satuan',
        path: '/app/master-data/produk',
        roles: ['admin'],
      },
      {
        id: 'master-pengguna',
        label: 'Pengguna & Peran',
        path: '/app/master-data/pengguna',
        roles: ['admin'],
      },
    ],
  },
]

export function getNavForRole(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}

export function canAccessPath(role: UserRole, path: string): boolean {
  if (path.startsWith('/app/settings')) return true
  if (path.startsWith('/app/dashboard')) return true

  return NAV_GROUPS.some((group) =>
    group.items.some(
      (item) =>
        item.roles.includes(role) &&
        (path === item.path || path.startsWith(`${item.path}/`)),
    ),
  )
}
