import { createLocalRepository } from '@/lib/create-local-repository'
import {
  SEED_CUSTOMERS,
  SEED_PRODUCTS,
  SEED_SUPPLIERS,
  SEED_USERS,
  normalizePartner,
  normalizeProduct,
  normalizeUser,
  type MasterPartner,
  type MasterProduct,
  type MasterUser,
} from '@/features/master/master-data'

export type MasterSnapshot = {
  version: 1
  suppliers: MasterPartner[]
  customers: MasterPartner[]
  products: MasterProduct[]
  users: MasterUser[]
  updatedAt: string
}

function seed(): MasterSnapshot {
  return {
    version: 1,
    suppliers: structuredClone(SEED_SUPPLIERS),
    customers: structuredClone(SEED_CUSTOMERS),
    products: structuredClone(SEED_PRODUCTS),
    users: structuredClone(SEED_USERS),
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is MasterSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as MasterSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.suppliers) &&
    Array.isArray(v.customers) &&
    Array.isArray(v.products) &&
    Array.isArray(v.users)
  )
}

function normalizeSnapshot(raw: MasterSnapshot): MasterSnapshot {
  return {
    ...raw,
    suppliers: raw.suppliers.map((p) => normalizePartner(p)),
    customers: raw.customers.map((p) => normalizePartner(p)),
    products: raw.products.map((p) => normalizeProduct(p)),
    users: raw.users.map((u) => normalizeUser(u)),
  }
}

const baseRepository = createLocalRepository({
  key: 'egabah.master.v1',
  seed,
  isValid,
})

export const masterRepository = {
  load(): MasterSnapshot {
    return normalizeSnapshot(baseRepository.load())
  },
  save(value: MasterSnapshot) {
    baseRepository.save(normalizeSnapshot(value))
  },
}

export function lookupSupplier(id: string) {
  return masterRepository.load().suppliers.find((s) => s.id === id)
}

export function lookupCustomer(id: string) {
  return masterRepository.load().customers.find((c) => c.id === id)
}

export function lookupProductBySku(sku: string) {
  return masterRepository.load().products.find((p) => p.sku === sku)
}

export function lookupActiveSuppliers() {
  return masterRepository.load().suppliers.filter((s) => s.active)
}

export function lookupActiveCustomers() {
  return masterRepository.load().customers.filter((c) => c.active)
}

export function lookupSaleProducts() {
  return masterRepository
    .load()
    .products.filter(
      (p) => p.active && (p.category === 'beras' || p.category === 'sampingan'),
    )
}
