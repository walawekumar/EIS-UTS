import { PenerimaanView } from '@/components/pembelian/PenerimaanView'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'

export function PenerimaanPage() {
  const {
    purchases,
    saveWeighing,
    confirmWeighing,
    voidPurchase,
    updatePurchaseProofs,
    completePurchase,
  } = usePembelian()
  const { selectedId, select, goTo } = useSelectedDoc()

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
      onVoid={(id, reason) => {
        voidPurchase(id, reason)
        select(null)
      }}
      onGoTo={goTo}
      onUpdatePurchaseProof={(id, purchaseProof) =>
        updatePurchaseProofs(id, { purchaseProof })
      }
      onCompletePurchase={completePurchase}
    />
  )
}
