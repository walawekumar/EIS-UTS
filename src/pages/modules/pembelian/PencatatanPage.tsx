import { useState } from 'react'
import { PembelianSubnav } from '@/components/pembelian/PembelianSubnav'
import { PencatatanView } from '@/components/pembelian/PencatatanView'
import { PurchaseFormDrawer } from '@/components/pembelian/PurchaseFormDrawer'
import { StatStrip } from '@/components/pembelian/StatStrip'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'
import {
  SUPPLIERS,
  formatKg,
  formatNumber,
  formatRupiahShort,
  nextPurchaseId,
} from '@/features/pembelian/pembelian-data'

export function PencatatanPage() {
  const { purchases, createPurchase, deletePurchase } = usePembelian()
  const { selectedId, select, goTo } = useSelectedDoc()
  const [formOpen, setFormOpen] = useState(false)

  const inProcess = purchases.filter((p) => p.stage !== 'diterima')
  const waiting = purchases.filter((p) => p.stage === 'dicatat').length

  return (
    <div className="space-y-3">
      <PembelianSubnav />

      <StatStrip
        items={[
          {
            label: 'Pembelian dicatat',
            value: `${formatNumber(purchases.length)} dokumen`,
            hint: `${waiting} belum ditimbang`,
          },
          {
            label: 'Total taksiran berat',
            value: formatKg(purchases.reduce((sum, p) => sum + p.estimatedKg, 0)),
            hint: `${formatNumber(purchases.reduce((sum, p) => sum + p.sacks, 0))} karung`,
          },
          {
            label: 'Nilai dalam proses',
            value: formatRupiahShort(inProcess.reduce((sum, p) => sum + p.estimatedKg * p.price, 0)),
            hint: `${inProcess.length} dokumen belum diterima`,
          },
          {
            label: 'Pemasok aktif',
            value: formatNumber(new Set(purchases.map((p) => p.supplierId)).size),
            hint: `dari ${SUPPLIERS.length} pemasok terdaftar`,
          },
        ]}
      />

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
    </div>
  )
}
