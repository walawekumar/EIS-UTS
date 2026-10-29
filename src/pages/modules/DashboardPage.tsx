import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

export function DashboardPage() {
  return (
    <ModulePlaceholder
      moduleName="Dashboard"
      notes={[
        'Ringkasan stok gabah & produk',
        'Status pembelian, produksi, dan penjualan',
        'Utang, piutang, dan kas singkat',
      ]}
    />
  )
}
