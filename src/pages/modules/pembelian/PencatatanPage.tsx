import { useState } from 'react'
import { PencatatanView } from '@/components/pembelian/PencatatanView'
import { PurchaseFormDrawer } from '@/components/pembelian/PurchaseFormDrawer'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'
import { nextPurchaseId } from '@/features/pembelian/pembelian-data'

export function PencatatanPage() {
  const {
    purchases,
    createPurchase,
    deletePurchase,
    submitPurchase,
    approvePurchase,
    rejectPurchase,
    reopenPurchaseDraft,
    updatePurchaseProofs,
  } = usePembelian()
  const { selectedId, select, goTo } = useSelectedDoc()
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <>
      <PencatatanView
        purchases={purchases}
        selectedId={selectedId}
        onSelect={select}
        onCreate={() => setFormOpen(true)}
        onDelete={(id) => {
          deletePurchase(id)
          select(null)
        }}
        onGoTo={goTo}
        onSubmitPurchase={submitPurchase}
        onApprovePurchase={approvePurchase}
        onRejectPurchase={rejectPurchase}
        onReopenDraft={reopenPurchaseDraft}
        onUpdateInvoiceProof={(id, invoiceProof) =>
          updatePurchaseProofs(id, { invoiceProof })
        }
      />

      <PurchaseFormDrawer
        open={formOpen}
        nextId={nextPurchaseId(purchases)}
        onClose={() => {
          setFormError(null)
          setFormOpen(false)
        }}
        error={formError}
        onSave={(data) => {
          const result = createPurchase(data)
          if (!result.ok) {
            setFormError(result.error)
            return
          }
          setFormError(null)
          setFormOpen(false)
          select(result.id)
        }}
      />
    </>
  )
}
