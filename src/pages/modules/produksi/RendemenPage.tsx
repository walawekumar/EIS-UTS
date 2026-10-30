import { RendemenView } from '@/components/produksi/RendemenView'
import {
  useProduksi,
  useSelectedBatch,
} from '@/features/produksi/ProduksiContext'

export function RendemenPage() {
  const { batches, lotCosts } = useProduksi()
  const { selectedId, select, goTo } = useSelectedBatch()

  return (
    <RendemenView
      batches={batches}
      lotCosts={lotCosts}
      selectedId={selectedId}
      onSelect={select}
      onGoToBatch={(id) => goTo('batch', id)}
    />
  )
}
