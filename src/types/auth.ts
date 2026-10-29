export type UserRole =
  | 'admin'
  | 'pembelian'
  | 'produksi'
  | 'gudang'
  | 'penjualan'
  | 'keuangan'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: UserRole
  roleLabel: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Pemilik / Admin',
  pembelian: 'Petugas Pembelian',
  produksi: 'Operator Produksi',
  gudang: 'Petugas Gudang',
  penjualan: 'Petugas Penjualan',
  keuangan: 'Petugas Keuangan',
}
