import { useState } from 'react'
import { BatchFormDrawer } from '@/components/produksi/BatchFormDrawer'
import { BatchView } from '@/components/produksi/BatchView'
import {
  useProduksi,
  useSelectedBatch,
} from '@/features/produksi/ProduksiContext'
import { nextBatchId } from '@/features/produksi/produksi-data'

export function BatchPage() {
  const {
    batches,
    createBatch,
    submitBatch,
    approveBatch,
    rejectBatch,
    startBatch,
    completeBatch,
    voidBatch,
    deleteBatch,
  } = useProduksi()
  const { selectedId, select, goTo } = useSelectedBatch()
  const [formOpen, setFormOpen] = useState(false)

  return (
    <>
      <BatchView
        batches={batches}
        selectedId={selectedId}
        onSelect={select}
        onCreate={() => setFormOpen(true)}
        onSubmit={submitBatch}
        onApprove={approveBatch}
        onReject={rejectBatch}
        onStart={startBatch}
        onComplete={completeBatch}
        onVoid={voidBatch}
        onDelete={deleteBatch}
        onGoTo={goTo}
      />

      <BatchFormDrawer
        open={formOpen}
        nextId={nextBatchId(batches)}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          const id = createBatch(data)
          setFormOpen(false)
          select(id)
        }}
      />
    </>
  )
}
