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

/** Menu ketat per peran — operasional dipisah orang */
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
        id: 'pembelian-gabah',
        label: 'Pembelian Gabah',
        path: '/app/pembelian',
        roles: ['admin', 'pembelian'],
      },
    ],
  },
  {
    id: 'persediaan',
    label: 'Persediaan',
    items: [
      {
        id: 'stok',
        label: 'Stok & Mutasi',
        path: '/app/persediaan',
        roles: ['admin', 'gudang'],
      },
    ],
  },
  {
    id: 'produksi',
    label: 'Produksi',
    items: [
      {
        id: 'batch',
        label: 'Batch Produksi',
        path: '/app/produksi',
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
        label: 'Penjualan & Kirim',
        path: '/app/penjualan',
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
        label: 'Kas, Utang & Piutang',
        path: '/app/keuangan',
        roles: ['admin', 'keuangan'],
      },
    ],
  },
  {
    id: 'master',
    label: 'Master Data',
    items: [
      {
        id: 'master-data',
        label: 'Data Acuan',
        path: '/app/master-data',
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
      (item) => path.startsWith(item.path) && item.roles.includes(role),
    ),
  )
}
