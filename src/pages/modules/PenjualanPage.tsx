import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

export function PenjualanPage() {
  return (
    <ModulePlaceholder
      moduleName="Penjualan"
      notes={['Order penjualan', 'Pengiriman & pengurangan stok', 'Tagihan pelanggan']}
    />
  )
}
