import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'

export function computePpn(input: {
  subtotal: number
  rate: PpnRate
  priceMode: PriceMode
}): { dpp: number; ppn: number; total: number } {
  const subtotal = Math.round(input.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return { dpp: 0, ppn: 0, total: 0 }
  }
  if (input.rate === 0) {
    return { dpp: subtotal, ppn: 0, total: subtotal }
  }
  if (input.priceMode === 'exclusive') {
    const dpp = subtotal
    const ppn = Math.round((dpp * input.rate) / 100)
    return { dpp, ppn, total: dpp + ppn }
  }
  const total = subtotal
  const dpp = Math.round(total / (1 + input.rate / 100))
  const ppn = total - dpp
  return { dpp, ppn, total }
}
