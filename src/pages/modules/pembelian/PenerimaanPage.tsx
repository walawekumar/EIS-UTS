import { PenerimaanView } from '@/components/pembelian/PenerimaanView'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'

export function PenerimaanPage() {
  const { purchases, saveWeighing, confirmWeighing } = usePembelian()
  const { selectedId, select, goTo } = useSelectedDoc()

  // Kunci pilihan setelah aksi, karena dokumen pindah kelompok antrean
  return (
    <PenerimaanView
      purchases={purchases}
      selectedId={selectedId}
      onSelect={select}
      onSaveWeighing={(id, input) => {
        saveWeighing(id, input)
        select(id)
      }}
      onConfirm={(id, input) => {
        confirmWeighing(id, input)
        select(id)
      }}
      onGoTo={goTo}
    />
  )
}
