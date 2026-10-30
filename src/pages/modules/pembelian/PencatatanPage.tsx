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
    updatePurchaseProofs,
  } = usePembelian()
  const { selectedId, select, goTo } = useSelectedDoc()
  const [formOpen, setFormOpen] = useState(false)

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
        onUpdateInvoiceProof={(id, invoiceProof) =>
          updatePurchaseProofs(id, { invoiceProof })
        }
      />

      <PurchaseFormDrawer
        open={formOpen}
        nextId={nextPurchaseId(purchases)}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          const id = createPurchase(data)
          setFormOpen(false)
          select(id)
        }}
      />
    </>
  )
}
