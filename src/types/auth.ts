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

const USER_ROLES = Object.keys(ROLE_LABELS) as UserRole[]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.some((role) => role === value)
}
