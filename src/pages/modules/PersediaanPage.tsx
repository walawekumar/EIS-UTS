import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

export function PersediaanPage() {
  return (
    <ModulePlaceholder
      moduleName="Persediaan"
      notes={['Saldo bahan baku & produk', 'Mutasi stok', 'Koreksi dengan alasan']}
    />
  )
}
