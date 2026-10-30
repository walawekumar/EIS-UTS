import { ROLE_LABELS, type AuthUser, type UserRole } from '@/types/auth'

/** Akun demo MVP — diganti Supabase Auth nanti. Password: demo123 */
export type DemoAccount = {
  email: string
  password: string
  name: string
  role: UserRole
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'admin@egabah.local',
    password: 'demo123',
    name: 'Admin E-Gabah',
    role: 'admin',
  },
  {
    email: 'beli@egabah.local',
    password: 'demo123',
    name: 'Petugas Pembelian',
    role: 'pembelian',
  },
  {
    email: 'produksi@egabah.local',
    password: 'demo123',
    name: 'Operator Produksi',
    role: 'produksi',
  },
  {
    email: 'gudang@egabah.local',
    password: 'demo123',
    name: 'Petugas Gudang',
    role: 'gudang',
  },
  {
    email: 'jual@egabah.local',
    password: 'demo123',
    name: 'Petugas Penjualan',
    role: 'penjualan',
  },
  {
    email: 'kas@egabah.local',
    password: 'demo123',
    name: 'Petugas Keuangan',
    role: 'keuangan',
  },
]

export function findDemoAccount(
  email: string,
  password: string,
): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase()
  return DEMO_ACCOUNTS.find(
    (a) => a.email === normalized && a.password === password,
  )
}

export function toAuthUser(account: DemoAccount): AuthUser {
  return {
    id: `USR-${account.role.toUpperCase()}`,
    name: account.name,
    email: account.email,
    role: account.role,
    roleLabel: ROLE_LABELS[account.role],
  }
}
