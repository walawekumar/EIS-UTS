import { mkdirSync, writeFileSync } from 'node:fs'
import {
  SEED_CUSTOMERS,
  SEED_PRODUCTS,
  SEED_SUPPLIERS,
  type MasterPartner,
  type MasterProduct,
} from '../src/features/master/master-data'

function esc(s: string) {
  return s.replace(/'/g, "''")
}

function partnerSql(p: MasterPartner) {
  return `  ('${esc(p.id)}', '${p.kind}', '${esc(p.name)}', '${esc(p.legalName)}', '${esc(p.group)}', '${esc(p.area)}', '${esc(p.postalCode)}', '${esc(p.phone)}', '${esc(p.email)}', '${esc(p.address)}', '${esc(p.contactName)}', '${esc(p.contactPhone)}', '${esc(p.npwp)}', ${p.pkp}, '${esc(p.bankName)}', '${esc(p.bankAccount)}', '${esc(p.bankHolder)}', '${p.paymentMethod}', ${p.paymentTermDays}, ${p.creditLimit}, ${p.active}, '${esc(p.note)}')`
}

function productSql(p: MasterProduct) {
  return `  ('${esc(p.id)}', '${esc(p.sku)}', '${esc(p.name)}', '${esc(p.unit)}', '${p.category}', '${esc(p.barcode)}', ${p.defaultPrice}, ${p.costPrice}, ${p.minQty}, ${p.taxable}, ${p.active}, '${esc(p.note)}')`
}

const partners = [...SEED_SUPPLIERS, ...SEED_CUSTOMERS]

const out = `-- Seed partners + products from master-data.ts SEED_*
-- Run after 20261030_master_rbac.sql

insert into public.partners (
  id, kind, name, legal_name, "group", area, postal_code, phone, email, address,
  contact_name, contact_phone, npwp, pkp, bank_name, bank_account, bank_holder,
  payment_method, payment_term_days, credit_limit, active, note
) values
${partners.map(partnerSql).join(',\n')}
on conflict (id) do update set
  kind = excluded.kind,
  name = excluded.name,
  legal_name = excluded.legal_name,
  "group" = excluded."group",
  area = excluded.area,
  postal_code = excluded.postal_code,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  contact_name = excluded.contact_name,
  contact_phone = excluded.contact_phone,
  npwp = excluded.npwp,
  pkp = excluded.pkp,
  bank_name = excluded.bank_name,
  bank_account = excluded.bank_account,
  bank_holder = excluded.bank_holder,
  payment_method = excluded.payment_method,
  payment_term_days = excluded.payment_term_days,
  credit_limit = excluded.credit_limit,
  active = excluded.active,
  note = excluded.note,
  updated_at = now();

insert into public.products (
  id, sku, name, unit, category, barcode, default_price, cost_price, min_qty, taxable, active, note
) values
${SEED_PRODUCTS.map(productSql).join(',\n')}
on conflict (id) do update set
  sku = excluded.sku,
  name = excluded.name,
  unit = excluded.unit,
  category = excluded.category,
  barcode = excluded.barcode,
  default_price = excluded.default_price,
  cost_price = excluded.cost_price,
  min_qty = excluded.min_qty,
  taxable = excluded.taxable,
  active = excluded.active,
  note = excluded.note,
  updated_at = now();
`

mkdirSync('supabase/seed', { recursive: true })
writeFileSync('supabase/seed/20261030_master_data.sql', out)
console.log(`wrote ${partners.length} partners, ${SEED_PRODUCTS.length} products`)
