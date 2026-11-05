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
  hrFocus?: {
    pendingLeave: number
    presentToday: number
    lateToday: number
    payrollQueue: number
  }
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
        positive: cashBal >= 0
      },
      {
        label: 'Piutang terbuka',
        value: idrShort(arSum),
        delta: `${arOpen.length} dok`,
        positive: arSum === 0
      },
      {
        label: 'Utang terbuka',
        value: idrShort(apSum),
        delta: `${apOpen.length} dok`,
        positive: apSum === 0
      },
      {
        label: 'Stok rendah',
        value: String(low.length),
        delta: low.length ? 'Perlu isi' : 'OK',
        positive: low.length === 0
      },
    ],
    pembelian: [
      {
        label: 'Dokumen terbuka',
        value: String(openPurchases.length),
        delta: 'belum diterima',
        positive: openPurchases.length === 0
      },
      {
        label: 'Nilai diterima',
        value: idrShort(buyValue),
        delta: 'bulan berjalan',
        positive: true
      },
      {
        label: 'Utang pemasok',
        value: idrShort(apSum),
        delta: `${apOpen.length} open`,
        positive: apSum === 0
      },
      {
        label: 'Menunggu timbang',
        value: String(
          input.purchases.filter((p) => p.stage === 'ditimbang').length,
        ),
        delta: 'konfirmasi',
        positive: true
      },
    ],
    produksi: [
      {
        label: 'Batch aktif',
        value: String(activeBatches.length),
        delta: `${input.batches.length} total`,
        positive: true
      },
      {
        label: 'Avg rendemen',
        value: `${avgRend.toFixed(1)}%`,
        delta: 'batch selesai',
        positive: avgRend >= 60
      },
      {
        label: 'Menunggu approve',
        value: String(
          input.batches.filter((b) => b.stage === 'submitted').length,
        ),
        delta: 'review',
        positive: true
      },
      {
        label: 'Selesai',
        value: String(doneBatches.length),
        delta: 'posted',
        positive: true
      },
    ],
    gudang: [
      {
        label: 'SKU lokasi',
        value: String(input.stocks.length),
        delta: 'baris saldo',
        positive: true
      },
      {
        label: 'Stok rendah',
        value: String(low.length),
        delta: low.length ? 'aksi' : 'aman',
        positive: low.length === 0
      },
      {
        label: 'SKU aman',
        value: String(Math.max(0, input.stocks.length - low.length)),
        delta: low.length ? `${low.length} rendah` : 'Aman',
        positive: low.length === 0
      },
      {
        label: 'Batch proses',
        value: String(
          input.batches.filter((b) => b.stage === 'processing').length,
        ),
        delta: 'lantai',
        positive: true
      },
    ],
    penjualan: [
      {
        label: 'Order terbuka',
        value: String(openOrders.length),
        delta: 'belum kirim',
        positive: openOrders.length === 0
      },
      {
        label: 'Nilai terkirim',
        value: idrShort(saleValue),
        delta: 'omzet',
        positive: true
      },
      {
        label: 'Piutang',
        value: idrShort(arSum),
        delta: `${arOpen.length} dok`,
        positive: arSum === 0
      },
      {
        label: 'Stok rendah',
        value: String(low.length),
        delta: 'siap jual',
        positive: low.length === 0
      },
    ],
    keuangan: [
      {
        label: 'Saldo kas',
        value: idrShort(cashBal),
        delta: 'posisi',
        positive: cashBal >= 0
      },
      {
        label: 'Piutang',
        value: idrShort(arSum),
        delta: `${arOpen.length} open`,
        positive: arSum === 0
      },
      {
        label: 'Utang',
        value: idrShort(apSum),
        delta: `${apOpen.length} open`,
        positive: apSum === 0
      },
      {
        label: 'Laba kotor kasar',
        value: idrShort(saleValue - buyValue),
        delta: 'jual − beli',
        positive: saleValue >= buyValue
      },
    ],
    hr: [
      {
        label: 'Cuti menunggu',
        value: String(input.hrFocus?.pendingLeave ?? 0),
        delta: (input.hrFocus?.pendingLeave ?? 0) ? 'Perlu review' : 'Kosong',
        positive: (input.hrFocus?.pendingLeave ?? 0) === 0,
      },
      {
        label: 'Hadir hari ini',
        value: String(input.hrFocus?.presentToday ?? 0),
        delta: (input.hrFocus?.lateToday ?? 0)
          ? `${input.hrFocus?.lateToday} terlambat`
          : 'Hari ini',
        positive: (input.hrFocus?.lateToday ?? 0) === 0,
      },
      {
        label: 'Terlambat hari ini',
        value: String(input.hrFocus?.lateToday ?? 0),
        delta: (input.hrFocus?.lateToday ?? 0) ? 'Perlu perhatian' : 'Kosong',
        positive: (input.hrFocus?.lateToday ?? 0) === 0,
      },
      {
        label: 'Antrian gaji',
        value: String(input.hrFocus?.payrollQueue ?? 0),
        delta: (input.hrFocus?.payrollQueue ?? 0) ? 'Perlu stamp' : 'Kosong',
        positive: (input.hrFocus?.payrollQueue ?? 0) === 0,
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
      description: 'Batch & rendemen',
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
      description: 'Kas, utang, piutang',
      chartTitle: 'Posisi kas',
    },
    hr: {
      title: 'SDM / HR',
      description: 'Cuti, absensi, payroll approve',
      chartTitle: 'Fokus SDM',
    },
  }

  const meta = titles[input.role]
  const toJt = (n: number) => Math.max(0, Math.round(n / 1_000_000))

  const opsLabels = ['Beli', 'Jual', 'Utang', 'Piutang', 'Kas', 'Margin'] as const
  const opsValues = [
    toJt(buyValue),
    toJt(saleValue),
    toJt(apSum),
    toJt(arSum),
    toJt(cashBal),
    toJt(Math.max(0, saleValue - buyValue)),
  ]

  const produksiLabels = doneBatches.slice(0, 7).map((b) => b.id.slice(-4))
  const produksiValues = doneBatches
    .slice(0, 7)
    .map((b) => Math.round(actualRendemen(b)))

  const gudangTop = [...input.stocks]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6)
  const gudangLabels = gudangTop.map((s) => s.sku.slice(0, 8))
  const gudangValues = gudangTop.map((s) => Math.round(s.qty))

  const chartByRole: Record<
    UserRole,
    { labels: string[]; values: number[]; unit: string; seriesName: string }
  > = {
    admin: {
      labels: [...opsLabels],
      values: opsValues,
      unit: 'jt Rp',
      seriesName: 'Posisi',
    },
    keuangan: {
      labels: [...opsLabels],
      values: opsValues,
      unit: 'jt Rp',
      seriesName: 'Posisi',
    },
    pembelian: {
      labels: ['Open', 'Diterima', 'Utang'],
      values: [
        openPurchases.length,
        toJt(buyValue),
        toJt(apSum),
      ],
      unit: 'dok / jt',
      seriesName: 'Pembelian',
    },
    penjualan: {
      labels: ['Open', 'Omzet', 'Piutang'],
      values: [openOrders.length, toJt(saleValue), toJt(arSum)],
      unit: 'dok / jt',
      seriesName: 'Penjualan',
    },
    produksi: {
      labels: produksiLabels.length ? produksiLabels : ['Kosong'],
      values: produksiValues.length ? produksiValues : [0],
      unit: '%',
      seriesName: 'Rendemen',
    },
    gudang: {
      labels: gudangLabels.length ? gudangLabels : ['Kosong'],
      values: gudangValues.length ? gudangValues : [0],
      unit: 'qty',
      seriesName: 'Saldo',
    },
    hr: {
      labels: ['Cuti', 'Hadir', 'Telat', 'Gaji'],
      values: [
        input.hrFocus?.pendingLeave ?? 0,
        input.hrFocus?.presentToday ?? 0,
        input.hrFocus?.lateToday ?? 0,
        input.hrFocus?.payrollQueue ?? 0,
      ],
      unit: 'orang / dok',
      seriesName: 'SDM',
    },
  }

  const chart = chartByRole[input.role]

  return {
    title: meta.title,
    description: meta.description,
    metrics: metricsByRole[input.role],
    chartTitle: meta.chartTitle,
    chartUnit: chart.unit,
    chartSeries: [
      {
        name: chart.seriesName,
        color: '#1B6B4A',
        values: chart.values,
      },
    ],
    chartLabels: chart.labels,
    activities: activities,
    stockTitle: 'Cuplikan stok',
    stockRows:
      stockRows.length > 0
        ? stockRows
        : [{ label: 'Kosong', value: '0', percent: 0, tone: 'warn' }],
  }
}
