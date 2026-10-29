import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

export function ProduksiPage() {
  return (
    <ModulePlaceholder
      moduleName="Produksi"
      notes={[
        'Batch produksi multi-output',
        'Input gabah → beras, menir, dedak, sekam',
        'Hitung rendemen & selisih massa',
      ]}
    />
  )
}
