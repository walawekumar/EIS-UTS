import { InputOutputView } from '@/components/produksi/InputOutputView'
import {
  useProduksi,
  useSelectedBatch,
} from '@/features/produksi/ProduksiContext'

export function InputOutputPage() {
  const { batches, updateOutputs } = useProduksi()
  const { selectedId, select, goTo } = useSelectedBatch()

  return (
    <InputOutputView
      batches={batches}
      selectedId={selectedId}
      onSelect={select}
      onUpdateOutputs={updateOutputs}
      onGoToBatch={(id) => goTo('batch', id)}
    />
  )
}
