import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

export function MasterDataPage() {
  return (
    <ModulePlaceholder
      moduleName="Master Data"
      notes={['Pemasok & pelanggan', 'Produk & satuan', 'Pengguna & peran']}
    />
  )
}
