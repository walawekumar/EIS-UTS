import type { LotCost } from '@/features/produksi/produksi-data'

export function cogsAmountForLot(
  lotCosts: LotCost[],
  lotId: string | undefined,
  qty: number,
): { ok: true; amount: number } | { ok: false; error: string } {
  if (!lotId?.trim()) {
    return { ok: false, error: 'Pilih lot costing untuk pengiriman.' }
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: 'Qty tidak valid untuk COGS.' }
  }
  const cost = lotCosts.find((l) => l.lotId === lotId)
  if (!cost) {
    return { ok: false, error: `LotCost tidak ditemukan untuk lot ${lotId}.` }
  }
  if (!(cost.costPerKgBeras > 0)) {
    return {
      ok: false,
      error: `Lot ${lotId} belum punya cost per kg beras.`,
    }
  }
  return { ok: true, amount: qty * cost.costPerKgBeras }
}
