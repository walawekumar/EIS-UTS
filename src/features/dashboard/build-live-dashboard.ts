import type { UserRole } from '@/types/auth'
import type { DashboardView, MetricCardData } from '@/features/dashboard/dashboard-data'
import type { CashEntry, PayableRow, ReceivableRow } from '@/features/keuangan/keuangan-data'
import type { Purchase } from '@/features/pembelian/pembelian-data'
import {
  isPurchaseReceivedForAp,
  summarize as summarizePurchase,
} from '@/features/pembelian/pembelian-data'
import type { SaleOrder } from '@/features/penjualan/penjualan-data'
import { summarize as summarizeSale } from '@/features/penjualan/penjualan-data'
import type { ProductionBatch } from '@/features/produksi/produksi-data'
import { actualRendemen } from '@/features/produksi/produksi-data'
import type { StockRow } from '@/features/persediaan/persediaan-data'
import { isLowStock } from '@/features/persediaan/persediaan-data'
import type { AuditLog } from '@/features/audit/audit-data'

function idrShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

function spark(base: number[]): number[] {
  return base
}

type LiveInput = {
  role: UserRole
  stocks: StockRow[]
  purchases: Purchase[]
  orders: SaleOrder[]
  batches: ProductionBatch[]
  cash: CashEntry[]
  payables: PayableRow[]
  receivables: ReceivableRow[]
  audit: AuditLog[]
}

export function buildLiveDashboard(input: LiveInput): DashboardView {
  const low = input.stocks.filter(isLowStock)
  const openPurchases = input.purchases.filter(
    (p) => !isPurchaseReceivedForAp(p.stage) && !p.voidedAt,
  )
  const openOrders = input.orders.filter(
    (o) => o.stage === 'dibuat' && !o.voidedAt,
  )
  const activeBatches = input.batches.filter((b) =>
    ['draft', 'submitted', 'approved', 'processing'].includes(b.stage),
  )
  const apOpen = input.payables.filter((p) => p.paid < p.amount)
  const arOpen = input.receivables.filter((r) => r.paid < r.amount)
  const apSum = apOpen.reduce((s, p) => s + (p.amount - p.paid), 0)
  const arSum = arOpen.reduce((s, r) => s + (r.amount - r.paid), 0)
  const cashBal = input.cash[0]?.balance ?? 0
  const doneBatches = input.batches.filter((b) => b.stage === 'done')
  const avgRend =
    doneBatches.length === 0
      ? 0
      : doneBatches.reduce((s, b) => s + actualRendemen(b), 0) /
        doneBatches.length

  const saleValue = input.orders
    .filter((o) => o.stage === 'dikirim')
    .reduce((s, o) => s + summarizeSale(o).total, 0)
  const buyValue = input.purchases
    .filter((p) => isPurchaseReceivedForAp(p.stage))
    .reduce((s, p) => s + summarizePurchase(p).total, 0)

  const metricsByRole: Record<UserRole, MetricCardData[]> = {
    admin: [
      {
        label: 'Saldo kas',
        value: idrShort(cashBal),
        delta: `${input.cash.length} entri`,
        positive: cashBal >= 0,
        spark: spark([40, 42, 45, 48, 50, 52, 55]),
      },
      {
        label: 'Piutang terbuka',
        value: idrShort(arSum),
        delta: `${arOpen.length} dok`,
        positive: arSum === 0,
        spark: spark([30, 28, 32, 30, 27, 25, 24]),
      },
      {
        label: 'Utang terbuka',
        value: idrShort(apSum),
        delta: `${apOpen.length} dok`,
        positive: apSum === 0,
        spark: spark([20, 22, 21, 19, 18, 17, 16]),
      },
      {
        label: 'Stok rendah',
        value: String(low.length),
        delta: low.length ? 'Perlu isi' : 'OK',
        positive: low.length === 0,
        spark: spark([2, 1, 2, 1, 0, 1, 1]),
      },
    ],
    pembelian: [
      {
        label: 'Dokumen terbuka',
        value: String(openPurchases.length),
        delta: 'belum diterima',
        positive: openPurchases.length === 0,
        spark: spark([3, 4, 3, 2, 3, 2, 2]),
      },
      {
        label: 'Nilai diterima',
        value: idrShort(buyValue),
        delta: 'bulan berjalan',
        positive: true,
        spark: spark([10, 12, 11, 14, 15, 16, 18]),
      },
      {
        label: 'Utang pemasok',
        value: idrShort(apSum),
        delta: `${apOpen.length} open`,
        positive: apSum === 0,
        spark: spark([8, 7, 9, 8, 6, 5, 5]),
      },
      {
        label: 'Menunggu timbang',
        value: String(
          input.purchases.filter((p) => p.stage === 'ditimbang').length,
        ),
        delta: 'konfirmasi',
        positive: true,
        spark: spark([1, 2, 1, 1, 0, 1, 1]),
      },
    ],
    produksi: [
      {
        label: 'Batch aktif',
        value: String(activeBatches.length),
        delta: `${input.batches.length} total`,
        positive: true,
        spark: spark([2, 3, 3, 4, 3, 4, 4]),
      },
      {
        label: 'Avg rendemen',
        value: `${avgRend.toFixed(1)}%`,
        delta: 'batch selesai',
        positive: avgRend >= 60,
        spark: spark([62, 63, 64, 65, 64, 66, 65]),
      },
      {
        label: 'Menunggu approve',
        value: String(
          input.batches.filter((b) => b.stage === 'submitted').length,
        ),
        delta: 'review',
        positive: true,
        spark: spark([1, 0, 1, 1, 0, 0, 1]),
      },
      {
        label: 'Selesai',
        value: String(doneBatches.length),
        delta: 'posted',
        positive: true,
        spark: spark([1, 2, 2, 3, 3, 4, 4]),
      },
    ],
    gudang: [
      {
        label: 'SKU lokasi',
        value: String(input.stocks.length),
        delta: 'baris saldo',
        positive: true,
        spark: spark([8, 8, 9, 9, 10, 10, 10]),
      },
      {
        label: 'Stok rendah',
        value: String(low.length),
        delta: low.length ? 'aksi' : 'aman',
        positive: low.length === 0,
        spark: spark([2, 2, 1, 1, 0, 1, 0]),
      },
      {
        label: 'Nilai kas (info)',
        value: idrShort(cashBal),
        delta: 'referensi',
        positive: true,
        spark: spark([40, 41, 42, 43, 44, 45, 46]),
      },
      {
        label: 'Batch proses',
        value: String(
          input.batches.filter((b) => b.stage === 'processing').length,
        ),
        delta: 'lantai',
        positive: true,
        spark: spark([1, 1, 2, 1, 1, 1, 2]),
      },
    ],
    penjualan: [
      {
        label: 'Order terbuka',
        value: String(openOrders.length),
        delta: 'belum kirim',
        positive: openOrders.length === 0,
        spark: spark([4, 3, 4, 2, 3, 2, 2]),
      },
      {
        label: 'Nilai terkirim',
        value: idrShort(saleValue),
        delta: 'omzet',
        positive: true,
        spark: spark([20, 22, 24, 23, 26, 28, 30]),
      },
      {
        label: 'Piutang',
        value: idrShort(arSum),
        delta: `${arOpen.length} dok`,
        positive: arSum === 0,
        spark: spark([15, 14, 16, 13, 12, 11, 10]),
      },
      {
        label: 'Stok rendah',
        value: String(low.length),
        delta: 'siap jual',
        positive: low.length === 0,
        spark: spark([1, 1, 0, 1, 0, 0, 1]),
      },
    ],
    keuangan: [
      {
        label: 'Saldo kas',
        value: idrShort(cashBal),
        delta: 'posisi',
        positive: cashBal >= 0,
        spark: spark([40, 42, 44, 46, 48, 50, 52]),
      },
      {
        label: 'Piutang',
        value: idrShort(arSum),
        delta: `${arOpen.length} open`,
        positive: arSum === 0,
        spark: spark([18, 17, 16, 15, 14, 13, 12]),
      },
      {
        label: 'Utang',
        value: idrShort(apSum),
        delta: `${apOpen.length} open`,
        positive: apSum === 0,
        spark: spark([12, 11, 13, 10, 9, 8, 8]),
      },
      {
        label: 'Laba kotor kasar',
        value: idrShort(saleValue - buyValue),
        delta: 'jual − beli',
        positive: saleValue >= buyValue,
        spark: spark([5, 6, 7, 6, 8, 9, 10]),
      },
    ],
  }

  const activities = input.audit.slice(0, 8).map((a) => ({
    date: new Date(a.at).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    type: a.entity,
    reference: a.entityId,
    amount: a.action,
    status: (a.action === 'void' || a.action === 'reject' ? 'warn' : 'ok') as
      | 'ok'
      | 'warn'
      | 'draft',
    actor: a.actor,
  }))

  const maxQty = Math.max(1, ...input.stocks.map((s) => s.qty))
  const stockRows = input.stocks.slice(0, 6).map((s) => ({
    label: `${s.name} · ${s.location}`,
    value: `${s.qty.toLocaleString('id-ID')} ${s.unit}`,
    percent: Math.min(100, Math.round((s.qty / maxQty) * 100)),
    tone: (isLowStock(s) ? 'warn' : 'ok') as 'ok' | 'warn',
  }))

  const titles: Record<UserRole, { title: string; description: string; chartTitle: string }> = {
    admin: {
      title: 'Ringkasan operasional',
      description: '',
      chartTitle: 'Posisi ringkas',
    },
    pembelian: {
      title: 'Pembelian',
      description: 'Dokumen & utang pemasok',
      chartTitle: 'Nilai penerimaan',
    },
    produksi: {
      title: 'Produksi',
      description: 'Batch & rendemen live',
      chartTitle: 'Rendemen batch',
    },
    gudang: {
      title: 'Gudang',
      description: 'Saldo & peringatan stok',
      chartTitle: 'SKU per lokasi',
    },
    penjualan: {
      title: 'Penjualan',
      description: 'Order, kirim, piutang',
      chartTitle: 'Omzet terkirim',
    },
    keuangan: {
      title: 'Keuangan',
      description: 'Kas, utang, piutang live',
      chartTitle: 'Posisi kas',
    },
  }

  const meta = titles[input.role]
  const adminChartLabels = [
    'Beli',
    'Jual',
    'Utang',
    'Piutang',
    'Kas',
    'Margin',
  ] as const
  const adminChartValues = [
    buyValue,
    saleValue,
    apSum,
    arSum,
    cashBal,
    Math.max(0, saleValue - buyValue),
  ].map((n) => Math.max(0, Math.round(n / 1_000_000)))

  const chartValues =
    input.role === 'produksi'
      ? doneBatches.slice(0, 7).map((b) => Math.round(actualRendemen(b)))
      : input.role === 'admin'
        ? [...adminChartValues]
        : [buyValue, saleValue, apSum, arSum, cashBal, saleValue - buyValue, cashBal].map(
            (n) => Math.max(0, Math.round(n / 1_000_000)),
          )

  while (chartValues.length < (input.role === 'admin' ? 6 : 7)) chartValues.push(0)

  return {
    title: meta.title,
    description: meta.description,
    metrics: metricsByRole[input.role],
    chartTitle: meta.chartTitle,
    chartUnit: input.role === 'produksi' ? '%' : 'jt Rp',
    chartSeries: [
      {
        name:
          input.role === 'produksi'
            ? 'Rendemen'
            : input.role === 'admin'
              ? 'jt Rp'
              : 'Nilai',
        color: '#1B6B4A',
        values:
          input.role === 'admin'
            ? chartValues.slice(0, 6)
            : chartValues.slice(0, 7),
      },
    ],
    chartLabels:
      input.role === 'admin'
        ? [...adminChartLabels]
        : input.role === 'produksi'
          ? chartValues.slice(0, 7).map((_, i) => `B${i + 1}`)
          : ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'],
    activities:
      activities.length > 0
        ? activities
        : [
            {
              date: '—',
              type: 'sistem',
              reference: '—',
              amount: '—',
              status: 'draft',
              actor: '—',
            },
          ],
    stockTitle: 'Cuplikan stok',
    stockRows:
      stockRows.length > 0
        ? stockRows
        : [{ label: 'Kosong', value: '0', percent: 0, tone: 'warn' }],
  }
}
