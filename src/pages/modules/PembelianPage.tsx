import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

export function PembelianPage() {
  return (
    <ModulePlaceholder
      moduleName="Pembelian"
      notes={[
        'Pencatatan pembelian gabah',
        'Penerimaan & konfirmasi berat',
        'Status pembayaran ke pemasok',
      ]}
    />
  )
}
