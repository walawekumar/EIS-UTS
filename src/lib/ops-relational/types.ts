export type OpsTableName =
  | 'purchases'
  | 'purchase_payments'
  | 'purchase_returns'
  | 'purchase_return_lines'
  | 'lot_qc'
  | 'sale_orders'
  | 'sale_order_payments'
  | 'sale_returns'
  | 'sale_return_lines'
  | 'production_batches'
  | 'batch_outputs'
  | 'pack_runs'
  | 'pack_run_lines'
  | 'lot_costs'
  | 'cash_entries'
  | 'payables'
  | 'receivables'
  | 'expenses'
  | 'period_locks'
  | 'period_unlock_requests'
  | 'bank_sessions'
  | 'bank_lines'
  | 'tax_settings'
  | 'tax_docs'
  | 'tax_invoices'
  | 'gl_accounts'
  | 'gl_account_map'
  | 'gl_journals'
  | 'gl_journal_lines'
  | 'gl_failed_posts'
  | 'payroll_runs'
  | 'payroll_lines'
  | 'audit_logs'

/** Module key for RLS / grouping — must match auth_can_write_module. */
export type OpsWriteModule =
  | 'pembelian'
  | 'penjualan'
  | 'produksi'
  | 'keuangan'
  | 'period'
  | 'bank'
  | 'tax'
  | 'gl'
  | 'payroll'
  | 'audit'

export type RelationalHydrateSpec = {
  table: OpsTableName
  module: OpsWriteModule
}

/** Every table that must be loaded before providers mount. */
export const ALL_RELATIONAL_HYDRATE_SPECS: RelationalHydrateSpec[] = [
  { table: 'purchases', module: 'pembelian' },
  { table: 'purchase_payments', module: 'pembelian' },
  { table: 'purchase_returns', module: 'pembelian' },
  { table: 'purchase_return_lines', module: 'pembelian' },
  { table: 'lot_qc', module: 'pembelian' },
  { table: 'sale_orders', module: 'penjualan' },
  { table: 'sale_order_payments', module: 'penjualan' },
  { table: 'sale_returns', module: 'penjualan' },
  { table: 'sale_return_lines', module: 'penjualan' },
  { table: 'production_batches', module: 'produksi' },
  { table: 'batch_outputs', module: 'produksi' },
  { table: 'pack_runs', module: 'produksi' },
  { table: 'pack_run_lines', module: 'produksi' },
  { table: 'lot_costs', module: 'produksi' },
  { table: 'cash_entries', module: 'keuangan' },
  { table: 'payables', module: 'keuangan' },
  { table: 'receivables', module: 'keuangan' },
  { table: 'expenses', module: 'keuangan' },
  { table: 'period_locks', module: 'period' },
  { table: 'period_unlock_requests', module: 'period' },
  { table: 'bank_sessions', module: 'bank' },
  { table: 'bank_lines', module: 'bank' },
  { table: 'tax_settings', module: 'tax' },
  { table: 'tax_docs', module: 'tax' },
  { table: 'tax_invoices', module: 'tax' },
  { table: 'gl_accounts', module: 'gl' },
  { table: 'gl_account_map', module: 'gl' },
  { table: 'gl_journals', module: 'gl' },
  { table: 'gl_journal_lines', module: 'gl' },
  { table: 'gl_failed_posts', module: 'gl' },
  { table: 'payroll_runs', module: 'payroll' },
  { table: 'payroll_lines', module: 'payroll' },
  { table: 'audit_logs', module: 'audit' },
]
