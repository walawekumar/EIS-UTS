import type { TaxInvoice, TaxSettings } from '@/features/keuangan/tax-data'

function esc(v: string | number): string {
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Minimal DJP-style practice columns — not certification. */
export function buildEfakturCsv(
  invoices: TaxInvoice[],
  settings: TaxSettings,
): string {
  const header = [
    'NPWP',
    'NomorFaktur',
    'Tanggal',
    'NamaLawanTransaksi',
    'DPP',
    'PPN',
    'Total',
    'Status',
  ].join(',')
  const rows = invoices
    .filter((i) => i.status !== 'void')
    .map((i) =>
      [
        esc(settings.npwp),
        esc(i.number),
        esc(i.date),
        esc(i.partyName ?? ''),
        esc(i.dpp),
        esc(i.ppn),
        esc(i.total),
        esc(i.status),
      ].join(','),
    )
  return [header, ...rows].join('\n')
}
