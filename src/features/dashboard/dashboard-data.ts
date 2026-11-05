import type { UserRole } from '@/types/auth'

export type MetricCardData = {
  label: string
  value: string
  delta: string
  positive: boolean
  /** Omit when no real series — fake decorative sparks look like AI filler. */
  spark?: number[]
}

export type ActivityRow = {
  date: string
  type: string
  reference: string
  amount: string
  status: 'ok' | 'warn' | 'draft'
  actor: string
}

export type StockRow = {
  label: string
  value: string
  percent: number
  tone?: 'ok' | 'warn'
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
  stockTitle: string
  stockRows: StockRow[]
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
      },
      {
        label: 'Batch aktif',
        value: '8',
        delta: '+2',
        positive: true,
      },
      {
        label: 'Penjualan hari ini',
        value: 'Rp 18,4 jt',
        delta: '+12%',
        positive: true,
      },
      {
        label: 'Kas & piutang',
        value: 'Rp 42,1 jt',
        delta: '-3,1%',
        positive: false,
      },
    ],
    chartTitle: 'Tren 7 hari',
    chartUnit: 'Indeks operasional',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Produksi', color: '#1a4d36', values: [42, 48, 45, 55, 52, 60, 58] },
      { name: 'Penjualan', color: '#35966b', values: [30, 34, 38, 36, 44, 48, 52] },
      { name: 'Pembelian', color: '#8fcbb0', values: [22, 28, 24, 30, 26, 32, 29] },
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
      {
        date: '27 Okt',
        type: 'Order',
        reference: 'SO-1102',
        amount: 'Rp 2,4 jt',
        status: 'ok',
        actor: 'Penjualan',
      },
      {
        date: '26 Okt',
        type: 'PO draft',
        reference: 'PO-0155',
        amount: 'Rp 6,0 jt',
        status: 'draft',
        actor: 'Pembelian',
      },
      {
        date: '26 Okt',
        type: 'Batch proses',
        reference: 'BAT-0187',
        amount: 'Input 800 kg',
        status: 'warn',
        actor: 'Produksi',
      },
      {
        date: '25 Okt',
        type: 'Kas masuk',
        reference: 'PAY-0328',
        amount: 'Rp 3,0 jt',
        status: 'ok',
        actor: 'Keuangan',
      },
      {
        date: '25 Okt',
        type: 'Pengiriman',
        reference: 'DO-0908',
        amount: 'Rp 1,8 jt',
        status: 'ok',
        actor: 'Penjualan',
      },
      {
        date: '24 Okt',
        type: 'Penerimaan',
        reference: 'RCV-0238',
        amount: '980 kg',
        status: 'ok',
        actor: 'Pembelian',
      },
      {
        date: '24 Okt',
        type: 'Biaya',
        reference: 'EXP-0118',
        amount: 'Rp 0,5 jt',
        status: 'draft',
        actor: 'Keuangan',
      },
      {
        date: '23 Okt',
        type: 'Batch selesai',
        reference: 'BAT-0184',
        amount: 'Rendemen 64%',
        status: 'ok',
        actor: 'Produksi',
      },
      {
        date: '23 Okt',
        type: 'Koreksi stok',
        reference: 'ADJ-0075',
        amount: '+12 kg',
        status: 'warn',
        actor: 'Gudang',
      },
      {
        date: '22 Okt',
        type: 'Order',
        reference: 'SO-1098',
        amount: 'Rp 3,1 jt',
        status: 'ok',
        actor: 'Penjualan',
      },
      {
        date: '22 Okt',
        type: 'Pembayaran',
        reference: 'PAY-0325',
        amount: 'Rp 1,2 jt',
        status: 'ok',
        actor: 'Keuangan',
      },
    ],
    stockTitle: 'Saldo gudang',
    stockRows: [
      { label: 'Gabah kering', value: '12.480 kg', percent: 72 },
      { label: 'Beras premium', value: '4.820 kg', percent: 58 },
      { label: 'Menir & dedak', value: '1.240 kg', percent: 41 },
      { label: 'Sekam', value: '860 kg', percent: 28, tone: 'warn' },
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
      },
      {
        label: 'Penerimaan hari ini',
        value: '2.150 kg',
        delta: '+8%',
        positive: true,
      },
      {
        label: 'Utang pemasok',
        value: 'Rp 9,8 jt',
        delta: '-2%',
        positive: true,
      },
      {
        label: 'Pemasok aktif',
        value: '18',
        delta: '+1',
        positive: true,
      },
    ],
    chartTitle: 'Volume pembelian',
    chartUnit: 'kg gabah',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Diterima', color: '#216348', values: [800, 1200, 900, 1500, 1100, 1800, 2150] },
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
    stockTitle: 'Antrian pasokan',
    stockRows: [
      { label: 'PO terbuka', value: '3 dok', percent: 45 },
      { label: 'Menunggu timbang', value: '1 truk', percent: 70, tone: 'warn' },
      { label: 'Utang pemasok', value: 'Rp 6,2 jt', percent: 62 },
      { label: 'Kuota harian', value: '2.150 kg', percent: 80 },
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
      },
      {
        label: 'Selesai hari ini',
        value: '6',
        delta: '+1',
        positive: true,
      },
      {
        label: 'Rendemen rata-rata',
        value: '64,2%',
        delta: '+0,4%',
        positive: true,
      },
      {
        label: 'Input gabah hari ini',
        value: '3.200 kg',
        delta: '+5%',
        positive: true,
      },
    ],
    chartTitle: 'Output batch',
    chartUnit: 'kg beras',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Beras', color: '#216348', values: [420, 480, 450, 510, 490, 530, 560] },
      { name: 'Sampingan', color: '#8a9a90', values: [120, 140, 130, 150, 145, 160, 155] },
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
    stockTitle: 'Kapasitas batch',
    stockRows: [
      { label: 'Mesin A', value: '82%', percent: 82, tone: 'warn' },
      { label: 'Mesin B', value: '64%', percent: 64 },
      { label: 'Antrian input', value: '2 batch', percent: 40 },
      { label: 'QC pending', value: '1 batch', percent: 25, tone: 'warn' },
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
      },
      {
        label: 'Stok beras',
        value: '4.820 kg',
        delta: '-1%',
        positive: false,
      },
      {
        label: 'Mutasi hari ini',
        value: '14',
        delta: '+3',
        positive: true,
      },
      {
        label: 'Produk sampingan',
        value: '860 kg',
        delta: '+2%',
        positive: true,
      },
    ],
    chartTitle: 'Mutasi stok',
    chartUnit: 'jumlah transaksi',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Masuk', color: '#216348', values: [4, 6, 5, 7, 6, 8, 9] },
      { name: 'Keluar', color: '#8a9a90', values: [3, 4, 5, 4, 6, 5, 5] },
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
    stockTitle: 'Saldo gudang',
    stockRows: [
      { label: 'Gabah kering', value: '12.480 kg', percent: 72 },
      { label: 'Beras premium', value: '4.820 kg', percent: 58 },
      { label: 'Beras medium', value: '2.100 kg', percent: 36 },
      { label: 'Lokasi A full', value: '91%', percent: 91, tone: 'warn' },
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
      },
      {
        label: 'Nilai penjualan',
        value: 'Rp 18,4 jt',
        delta: '+12%',
        positive: true,
      },
      {
        label: 'Piutang',
        value: 'Rp 7,2 jt',
        delta: '+5%',
        positive: false,
      },
      {
        label: 'Menunggu kirim',
        value: '3',
        delta: '-1',
        positive: true,
      },
    ],
    chartTitle: 'Nilai penjualan',
    chartUnit: 'juta rupiah',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Omzet', color: '#216348', values: [9, 11, 10, 13, 14, 16, 18] },
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
    stockTitle: 'Pipeline kirim',
    stockRows: [
      { label: 'DO menunggu muat', value: '3 dok', percent: 50 },
      { label: 'Siap kirim', value: '5 order', percent: 68 },
      { label: 'Tagihan tempo', value: 'Rp 2,1 jt', percent: 75, tone: 'warn' },
      { label: 'Stok beras siap', value: '4.820 kg', percent: 58 },
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
      },
      {
        label: 'Kas keluar',
        value: 'Rp 4,1 jt',
        delta: '-6%',
        positive: true,
      },
      {
        label: 'Utang / piutang',
        value: 'Rp 17,0 jt',
        delta: '+1%',
        positive: false,
      },
      {
        label: 'Biaya operasional',
        value: 'Rp 1,2 jt',
        delta: '-4%',
        positive: true,
      },
    ],
    chartTitle: 'Arus kas',
    chartUnit: 'juta rupiah',
    chartLabels: LABELS_7D,
    chartSeries: [
      { name: 'Masuk', color: '#216348', values: [6, 7, 8, 9, 10, 11, 12] },
      { name: 'Keluar', color: '#8a9a90', values: [5, 4.8, 4.5, 4.4, 4.3, 4.2, 4.1] },
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
    stockTitle: 'Posisi kas',
    stockRows: [
      { label: 'Kas masuk', value: 'Rp 12,6 jt', percent: 78 },
      { label: 'Kas keluar', value: 'Rp 4,1 jt', percent: 34 },
      { label: 'Utang pemasok', value: 'Rp 4,5 jt', percent: 70, tone: 'warn' },
      { label: 'Piutang pelanggan', value: 'Rp 2,8 jt', percent: 55 },
    ],
  },
}
