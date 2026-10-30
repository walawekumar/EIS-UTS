import { PenerimaanView } from '@/components/pembelian/PenerimaanView'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'

export function PenerimaanPage() {
  const {
    purchases,
    lotQc,
    saveWeighing,
    confirmWeighing,
    voidPurchase,
    completePurchase,
    overrideLotQcReceive,
  } = usePembelian()
  const { selectedId, select, goTo } = useSelectedDoc()

  return (
    <PenerimaanView
      purchases={purchases}
      lotQc={lotQc}
      selectedId={selectedId}
      onSelect={select}
      onSaveWeighing={(id, input) => {
        saveWeighing(id, input)
        select(id)
      }}
      onConfirm={(id, input, purchaseProof) =>
        confirmWeighing(id, input, purchaseProof)
      }
      onVoid={(id, reason) => {
        voidPurchase(id, reason)
        select(null)
      }}
      onGoTo={goTo}
      onCompletePurchase={completePurchase}
      onOverrideQc={overrideLotQcReceive}
    />
  )
}
