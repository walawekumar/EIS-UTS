import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

export function KeuanganPage() {
  return (
    <ModulePlaceholder
      moduleName="Keuangan"
      notes={['Kas masuk/keluar', 'Utang & piutang', 'Biaya operasional dasar']}
    />
  )
}
