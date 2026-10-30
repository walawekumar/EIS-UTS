import type {
  MasterPartner,
  MasterProduct,
  MasterUser,
  PartnerKind,
  PaymentMethodPref,
  ProductCategory,
} from '@/features/master/master-data'
import { ROLE_LABELS, type AuthUser, type UserRole } from '@/types/auth'

export type PartnerRow = {
  id: string
  kind: PartnerKind
  name: string
  legal_name: string
  group: string
  area: string
  postal_code: string
  phone: string
  email: string
  address: string
  contact_name: string
  contact_phone: string
  npwp: string
  pkp: boolean
  bank_name: string
  bank_account: string
  bank_holder: string
  payment_method: PaymentMethodPref
  payment_term_days: number
  credit_limit: number
  active: boolean
  note: string
}

export type ProductRow = {
  id: string
  sku: string
  name: string
  unit: string
  category: ProductCategory
  barcode: string
  default_price: number
  cost_price: number
  min_qty: number
  taxable: boolean
  active: boolean
  note: string
}

export type ProfileRow = {
  id: string
  email: string
  name: string
  role: UserRole
  title: string
  phone: string
  branch: string
  department: string
  active: boolean
}

export function partnerFromRow(r: PartnerRow): MasterPartner {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    legalName: r.legal_name,
    group: r.group,
    area: r.area,
    postalCode: r.postal_code,
    phone: r.phone,
    email: r.email,
    address: r.address,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    npwp: r.npwp,
    pkp: r.pkp,
    bankName: r.bank_name,
    bankAccount: r.bank_account,
    bankHolder: r.bank_holder,
    paymentMethod: r.payment_method,
    paymentTermDays: Number(r.payment_term_days) || 0,
    creditLimit: Number(r.credit_limit) || 0,
    active: r.active,
    note: r.note,
  }
}

export function partnerToRow(p: MasterPartner): PartnerRow {
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    legal_name: p.legalName,
    group: p.group,
    area: p.area,
    postal_code: p.postalCode,
    phone: p.phone,
    email: p.email,
    address: p.address,
    contact_name: p.contactName,
    contact_phone: p.contactPhone,
    npwp: p.npwp,
    pkp: p.pkp,
    bank_name: p.bankName,
    bank_account: p.bankAccount,
    bank_holder: p.bankHolder,
    payment_method: p.paymentMethod,
    payment_term_days: p.paymentTermDays,
    credit_limit: p.creditLimit,
    active: p.active,
    note: p.note,
  }
}

export function productFromRow(r: ProductRow): MasterProduct {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    unit: r.unit,
    category: r.category,
    barcode: r.barcode,
    defaultPrice: Number(r.default_price) || 0,
    costPrice: Number(r.cost_price) || 0,
    minQty: Number(r.min_qty) || 0,
    taxable: r.taxable,
    active: r.active,
    note: r.note,
  }
}

export function productToRow(p: MasterProduct): ProductRow {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    category: p.category,
    barcode: p.barcode,
    default_price: p.defaultPrice,
    cost_price: p.costPrice,
    min_qty: p.minQty,
    taxable: p.taxable,
    active: p.active,
    note: p.note,
  }
}

export function userFromProfile(r: ProfileRow): MasterUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    title: r.title,
    phone: r.phone,
    branch: r.branch,
    department: r.department,
    active: r.active,
  }
}

export function authUserFromProfile(r: ProfileRow): AuthUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    roleLabel: ROLE_LABELS[r.role],
  }
}
