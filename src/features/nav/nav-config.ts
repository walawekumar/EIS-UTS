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
        id: 'pembelian-pencatatan',
        label: 'Pencatatan',
        path: '/app/pembelian',
        roles: ['admin', 'pembelian', 'keuangan'],
      },
      {
        id: 'pembelian-penerimaan',
        label: 'Penerimaan',
        path: '/app/pembelian/penerimaan',
        roles: ['admin', 'pembelian', 'keuangan'],
      },
      {
        id: 'pembelian-pembayaran',
        label: 'Pembayaran',
        path: '/app/pembelian/pembayaran',
        roles: ['admin', 'pembelian', 'keuangan'],
      },
      {
        id: 'pembelian-retur',
        label: 'Retur',
        path: '/app/pembelian/retur',
        roles: ['admin', 'pembelian', 'keuangan'],
      },
      {
        id: 'pembelian-qc',
        label: 'QC Lot',
        path: '/app/pembelian/qc',
        roles: ['admin', 'pembelian', 'gudang'],
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
      {
        id: 'batch-packing',
        label: 'Packing',
        path: '/app/produksi/packing',
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
      {
        id: 'penjualan-retur',
        label: 'Retur',
        path: '/app/penjualan/retur',
        roles: ['admin', 'penjualan', 'keuangan'],
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
      {
        id: 'payroll',
        label: 'Payroll',
        path: '/app/keuangan/payroll',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'coa',
        label: 'Bagan Akun',
        path: '/app/keuangan/coa',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'akun-map',
        label: 'Pemetaan Akun',
        path: '/app/keuangan/akun-map',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'jurnal',
        label: 'Jurnal',
        path: '/app/keuangan/jurnal',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'e-faktur',
        label: 'e-Faktur',
        path: '/app/keuangan/e-faktur',
        roles: ['admin', 'keuangan'],
      },
      {
        id: 'periode',
        label: 'Periode',
        path: '/app/keuangan/periode',
        roles: [
          'admin',
          'keuangan',
          'pembelian',
          'penjualan',
          'produksi',
          'gudang',
        ],
      },
      {
        id: 'rekon-bank',
        label: 'Rekon Bank',
        path: '/app/keuangan/rekon-bank',
        roles: ['admin', 'keuangan'],
      },
    ],
  },
  {
    id: 'laporan',
    label: 'Laporan',
    items: [
      {
        id: 'laporan-ringkas',
        label: 'Ringkasan & Aging',
        path: '/app/laporan',
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
      {
        id: 'audit',
        label: 'Audit Log',
        path: '/app/audit',
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
