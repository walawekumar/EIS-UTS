import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { panelClass } from '@/components/pembelian/Toolbar'
import { BatchDetail } from '@/components/produksi/BatchDetail'
import { BatchFormDrawer } from '@/components/produksi/BatchFormDrawer'
import { BatchListView } from '@/components/produksi/BatchListView'
import { HasilFormDrawer } from '@/components/produksi/HasilFormDrawer'
import { ProductionSummary } from '@/components/produksi/ProductionSummary'
import { todayIso } from '@/features/pembelian/pembelian-data'
import {
  INITIAL_BATCHES,
  nextBatchId,
  type Batch,
  type BatchOutputs,
  type NewBatch,
} from '@/features/produksi/produksi-data'

// Data masih lokal — diganti Supabase nanti
export function ProduksiPage() {
  const [items, setItems] = useState<Batch[]>(INITIAL_BATCHES)
  const [params, setParams] = useSearchParams()
  const [formOpen, setFormOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)

  const batches = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
      ),
    [items],
  )

  const selectedId = params.get('batch')
  const selected =
    batches.find((b) => b.id === selectedId) ??
    batches.find((b) => b.status === 'proses') ??
    batches[0] ??
    null
  const recording = batches.find((b) => b.id === recordId) ?? null

  function select(id: string | null) {
    setParams(id ? { batch: id } : {}, { replace: true })
  }

  function patch(id: string, fn: (b: Batch) => Partial<Batch>) {
    setItems((list) => list.map((b) => (b.id === id ? { ...b, ...fn(b) } : b)))
    select(id)
  }

  function handleCreate(data: NewBatch, start: boolean) {
    const id = nextBatchId(items, new Date(`${data.date}T00:00:00`))
    setItems((list) => [
      { ...data, id, status: start ? 'proses' : 'rencana', startedAt: start ? todayIso() : undefined },
      ...list,
    ])
    setFormOpen(false)
    select(id)
  }

  function handleRecord(id: string, outputs: BatchOutputs, finishedAt: string, note?: string) {
    patch(id, () => ({ status: 'selesai', outputs, finishedAt, note }))
    setRecordId(null)
  }

  function handleCancel(id: string) {
    setItems((list) => list.filter((b) => b.id !== id))
    select(null)
  }

  return (
    <div className="space-y-4">
      <ProductionSummary batches={batches} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <BatchListView
          batches={batches}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onCreate={() => setFormOpen(true)}
        />

        <aside className={[panelClass, 'p-5 lg:sticky lg:top-0'].join(' ')}>
          {selected ? (
            <BatchDetail
              batch={selected}
              batches={batches}
              onStart={(id) => patch(id, () => ({ status: 'proses', startedAt: todayIso() }))}
              onCancel={handleCancel}
              onRecord={setRecordId}
            />
          ) : (
            <p className="py-8 text-center text-[13px] text-muted">Belum ada batch. Klik “Batch baru”.</p>
          )}
        </aside>
      </div>

      {formOpen ? (
        <BatchFormDrawer
          nextId={nextBatchId(items)}
          batches={items}
          onClose={() => setFormOpen(false)}
          onSave={handleCreate}
        />
      ) : null}

      {recording ? (
        <HasilFormDrawer
          batch={recording}
          onClose={() => setRecordId(null)}
          onSave={(outputs, finishedAt, note) => handleRecord(recording.id, outputs, finishedAt, note)}
        />
      ) : null}
    </div>
  )
}
