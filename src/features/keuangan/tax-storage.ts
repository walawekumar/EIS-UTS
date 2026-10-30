import { createLocalRepository } from '@/lib/create-local-repository'
import { assembleTax, projectTax } from '@/lib/ops-relational/mappers/tax'
import { createRelationalBackedRepository } from '@/lib/relational-backed-repository'
import { DEFAULT_TAX_SETTINGS, type TaxSnapshot } from '@/features/keuangan/tax-data'

function seed(): TaxSnapshot {
  return {
    version: 1,
    settings: { ...DEFAULT_TAX_SETTINGS },
    docs: [],
    invoices: [],
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is TaxSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as TaxSnapshot
  return (
    v.version === 1 &&
    v.settings != null &&
    Array.isArray(v.docs) &&
    Array.isArray(v.invoices)
  )
}

const inner = createLocalRepository({
  key: 'egabah.tax.v1',
  seed,
  isValid,
})

export const taxRepository = createRelationalBackedRepository({
  local: inner,
  tables: ['tax_settings', 'tax_docs', 'tax_invoices'],
  assemble: assembleTax,
  project: projectTax,
})
