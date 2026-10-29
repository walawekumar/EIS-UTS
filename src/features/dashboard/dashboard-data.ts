import type { UserRole } from '@/types/auth'

export type MetricCardData = {
  label: string
  value: string
  delta: string
  positive: boolean
  spark: number[]
}

export type ActivityRow = {
  date: string
  type: string
  reference: string
  amount: string
  status: 'ok' | 'warn' | 'draft'
  actor: string
}

export type SideItem = {
  title: string
  meta: string
  progress?: number
}

export type DashboardView = {
  title: string
  description: string
  metrics: MetricCardData[]
  chartTitle: string
  chartUnit: string
  chartSeries: { name: string; color: string; values: number[] }[]
  chartLabels: string[]
  activities: ActivityRow[]
  sideTitle: string
  sideItems: SideItem[]
}

const LABELS_7D = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export const DASHBOARD_BY_ROLE: Record<UserRole, DashboardView> = {
  admin: {
    title: 'Ringkasan usaha',
    description: 'Integrasi stok, produksi, penjualan, dan kas dalam satu pandangan.',
    metrics: [
      {
        label: 'Stok gabah',
        value: '12.480 kg',
        delta: '+4,2%',
        positive: true,
        spark: [40, 42, 45, 44, 48, 52, 55],
      },
      {
        label: 'Batch aktif',
        value: '8',
        delta: '+2',
        positive: true,
        spark: [3, 4, 5, 4, 6, 7, 8],
      },
      {
        label: 'Penjualan hari ini',
        value: 'Rp 18,4 jt',
        delta: '+12%',
        positive: true,
        spark: [10, 12, 11, 14, 13, 16, 18],
      },
      {
        label: 'Kas & piutang',
        value: 'Rp 42,1 jt',
        delta: '-3,1%',
        positive: false,
        spark: [48, 46, 45, 44, 43, 42, 42],
      },
    ],
    chartTitle: 'Tren 7 hari',
    chartUnit: 'Indeks operasional',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Produksi', color: '#1a4030', values: [42, 48, 45, 55, 52, 60, 58] },
      { name: 'Penjualan', color: '#1c1b19', values: [30, 34, 38, 36, 44, 48, 52] },
      { name: 'Pembelian', color: '#8a8882', values: [22, 28, 24, 30, 26, 32, 29] },
    ],
    activities: [
      {
        date: '29 Okt',
        type: 'Penerimaan',
        reference: 'RCV-0241',
        amount: '1.200 kg',
        status: 'ok',
        actor: 'Pembelian',
      },
      {
        date: '29 Okt',
        type: 'Batch selesai',
        reference: 'BAT-0188',
        amount: 'Rendemen 65%',
        status: 'ok',
        actor: 'Produksi',
      },
      {
        date: '28 Okt',
        type: 'Pengiriman',
        reference: 'DO-0912',
        amount: 'Rp 4,2 jt',
        status: 'warn',
        actor: 'Penjualan',
      },
      {
        date: '28 Okt',
        type: 'Pembayaran',
        reference: 'PAY-0330',
        amount: 'Rp 2,1 jt',
        status: 'ok',
        actor: 'Keuangan',
      },
      {
        date: '27 Okt',
        type: 'Koreksi stok',
        reference: 'ADJ-0077',
        amount: '-35 kg',
        status: 'draft',
        actor: 'Gudang',
      },
    ],
    sideTitle: 'Prioritas hari ini',
    sideItems: [
      { title: 'Konfirmasi penerimaan gabah', meta: '2 dokumen', progress: 60 },
      { title: 'Batch menunggu QC', meta: '1 batch', progress: 35 },
      { title: 'Piutang jatuh tempo', meta: 'Rp 3,4 jt', progress: 80 },
    ],
  },
  pembelian: {
    title: 'Ringkasan pembelian',
    description: 'Pantau PO, penerimaan gabah, dan utang pemasok.',
    metrics: [
      {
        label: 'PO draft',
        value: '3',
        delta: '+1',
        positive: false,
        spark: [1, 1, 2, 2, 2, 3, 3],
      },
      {
        label: 'Penerimaan hari ini',
        value: '2.150 kg',
        delta: '+8%',
        positive: true,
        spark: [12, 14, 13, 16, 18, 20, 21],
      },
      {
        label: 'Utang pemasok',
        value: 'Rp 9,8 jt',
        delta: '-2%',
        positive: true,
        spark: [12, 11, 11, 10, 10, 10, 9.8],
      },
    ],
    chartTitle: 'Volume pembelian',
    chartUnit: 'kg gabah',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Diterima', color: '#1a4030', values: [800, 1200, 900, 1500, 1100, 1800, 2150] },
    ],
    activities: [
      {
        date: '29 Okt',
        type: 'Penerimaan',
        reference: 'RCV-0241',
        amount: '1.200 kg',
        status: 'ok',
        actor: 'Anda',
      },
      {
        date: '29 Okt',
        type: 'PO draft',
        reference: 'PO-0155',
        amount: 'Rp 6,0 jt',
        status: 'draft',
        actor: 'Anda',
      },
      {
        date: '28 Okt',
        type: 'Penerimaan',
        reference: 'RCV-0240',
        amount: '950 kg',
        status: 'ok',
        actor: 'Anda',
      },
    ],
    sideTitle: 'Antrian pembelian',
    sideItems: [
      { title: 'PO menunggu konfirmasi', meta: '3 dokumen', progress: 40 },
      { title: 'Selisih timbang ditinjau', meta: '1 kasus', progress: 70 },
    ],
  },
  produksi: {
    title: 'Ringkasan produksi',
    description: 'Batch giling, rendemen, dan keluaran multi-produk.',
    metrics: [
      {
        label: 'Batch berjalan',
        value: '2',
        delta: '0',
        positive: true,
        spark: [1, 2, 2, 1, 2, 2, 2],
      },
      {
        label: 'Selesai hari ini',
        value: '6',
        delta: '+1',
        positive: true,
        spark: [3, 4, 5, 4, 5, 5, 6],
      },
      {
        label: 'Rendemen rata-rata',
        value: '64,2%',
        delta: '+0,4%',
        positive: true,
        spark: [62, 63, 63, 64, 63, 64, 64],
      },
    ],
    chartTitle: 'Output batch',
    chartUnit: 'kg beras',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Beras', color: '#1a4030', values: [420, 480, 450, 510, 490, 530, 560] },
      { name: 'Sampingan', color: '#8a8882', values: [120, 140, 130, 150, 145, 160, 155] },
    ],
    activities: [
      {
        date: '29 Okt',
        type: 'Batch selesai',
        reference: 'BAT-0188',
        amount: 'Rendemen 65%',
        status: 'ok',
        actor: 'Anda',
      },
      {
        date: '29 Okt',
        type: 'Batch proses',
        reference: 'BAT-0189',
        amount: 'Input 800 kg',
        status: 'warn',
        actor: 'Anda',
      },
    ],
    sideTitle: 'Antrian produksi',
    sideItems: [
      { title: 'Batch menunggu input', meta: 'BAT-0190', progress: 20 },
      { title: 'Hitung ulang rendemen', meta: 'BAT-0187', progress: 55 },
    ],
  },
  gudang: {
    title: 'Ringkasan persediaan',
    description: 'Saldo bahan baku, produk jadi, dan mutasi stok.',
    metrics: [
      {
        label: 'Stok gabah',
        value: '12.480 kg',
        delta: '+2%',
        positive: true,
        spark: [11, 11.5, 12, 12.1, 12.2, 12.3, 12.4],
      },
      {
        label: 'Stok beras',
        value: '4.820 kg',
        delta: '-1%',
        positive: false,
        spark: [5.1, 5.0, 4.9, 4.95, 4.9, 4.85, 4.82],
      },
      {
        label: 'Mutasi hari ini',
        value: '14',
        delta: '+3',
        positive: true,
        spark: [8, 9, 10, 11, 12, 13, 14],
      },
    ],
    chartTitle: 'Mutasi stok',
    chartUnit: 'jumlah transaksi',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Masuk', color: '#1a4030', values: [4, 6, 5, 7, 6, 8, 9] },
      { name: 'Keluar', color: '#8a8882', values: [3, 4, 5, 4, 6, 5, 5] },
    ],
    activities: [
      {
        date: '29 Okt',
        type: 'Masuk',
        reference: 'RCV-0241',
        amount: '+1.200 kg',
        status: 'ok',
        actor: 'Sistem',
      },
      {
        date: '29 Okt',
        type: 'Keluar',
        reference: 'BAT-0188',
        amount: '-800 kg',
        status: 'ok',
        actor: 'Produksi',
      },
      {
        date: '28 Okt',
        type: 'Koreksi',
        reference: 'ADJ-0077',
        amount: '-35 kg',
        status: 'draft',
        actor: 'Anda',
      },
    ],
    sideTitle: 'Perlu dicek',
    sideItems: [
      { title: 'Selisih fisik vs sistem', meta: 'Gudang A', progress: 45 },
      { title: 'Koreksi menunggu alasan', meta: 'ADJ-0077', progress: 25 },
    ],
  },
  penjualan: {
    title: 'Ringkasan penjualan',
    description: 'Order, pengiriman, dan status tagihan pelanggan.',
    metrics: [
      {
        label: 'Order hari ini',
        value: '11',
        delta: '+2',
        positive: true,
        spark: [6, 7, 8, 9, 8, 10, 11],
      },
      {
        label: 'Nilai penjualan',
        value: 'Rp 18,4 jt',
        delta: '+12%',
        positive: true,
        spark: [10, 12, 11, 14, 15, 17, 18],
      },
      {
        label: 'Piutang',
        value: 'Rp 7,2 jt',
        delta: '+5%',
        positive: false,
        spark: [6, 6.2, 6.5, 6.8, 7, 7.1, 7.2],
      },
    ],
    chartTitle: 'Nilai penjualan',
    chartUnit: 'juta rupiah',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Omzet', color: '#1a4030', values: [9, 11, 10, 13, 14, 16, 18] },
    ],
    activities: [
      {
        date: '29 Okt',
        type: 'Order',
        reference: 'SO-1102',
        amount: 'Rp 2,4 jt',
        status: 'ok',
        actor: 'Anda',
      },
      {
        date: '29 Okt',
        type: 'Pengiriman',
        reference: 'DO-0912',
        amount: 'Menunggu',
        status: 'warn',
        actor: 'Anda',
      },
    ],
    sideTitle: 'Antrean kirim',
    sideItems: [
      { title: 'DO menunggu muat', meta: '3 dokumen', progress: 50 },
      { title: 'Tagihan tempo', meta: 'Rp 2,1 jt', progress: 75 },
    ],
  },
  keuangan: {
    title: 'Ringkasan keuangan',
    description: 'Kas masuk/keluar, utang, dan piutang dasar.',
    metrics: [
      {
        label: 'Kas masuk',
        value: 'Rp 12,6 jt',
        delta: '+9%',
        positive: true,
        spark: [8, 9, 9.5, 10, 11, 12, 12.6],
      },
      {
        label: 'Kas keluar',
        value: 'Rp 4,1 jt',
        delta: '-6%',
        positive: true,
        spark: [5, 4.8, 4.6, 4.5, 4.3, 4.2, 4.1],
      },
      {
        label: 'Utang / piutang',
        value: 'Rp 17,0 jt',
        delta: '+1%',
        positive: false,
        spark: [16, 16.2, 16.5, 16.7, 16.8, 16.9, 17],
      },
    ],
    chartTitle: 'Arus kas',
    chartUnit: 'juta rupiah',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Masuk', color: '#1a4030', values: [6, 7, 8, 9, 10, 11, 12] },
      { name: 'Keluar', color: '#8a8882', values: [5, 4.8, 4.5, 4.4, 4.3, 4.2, 4.1] },
    ],
    activities: [
      {
        date: '29 Okt',
        type: 'Kas masuk',
        reference: 'PAY-0331',
        amount: 'Rp 3,0 jt',
        status: 'ok',
        actor: 'Anda',
      },
      {
        date: '28 Okt',
        type: 'Biaya',
        reference: 'EXP-0120',
        amount: 'Rp 0,8 jt',
        status: 'ok',
        actor: 'Anda',
      },
    ],
    sideTitle: 'Jatuh tempo',
    sideItems: [
      { title: 'Utang pemasok', meta: 'Rp 4,5 jt · 3 hari', progress: 70 },
      { title: 'Piutang pelanggan', meta: 'Rp 2,8 jt · 5 hari', progress: 55 },
    ],
  },
}
