import { PembelianSubnav } from '@/components/pembelian/PembelianSubnav'
import { PenerimaanView } from '@/components/pembelian/PenerimaanView'
import { StatStrip } from '@/components/pembelian/StatStrip'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'
import { formatKg, formatPercent, summarize } from '@/features/pembelian/pembelian-data'

export function PenerimaanPage() {
  const { purchases, saveWeighing, confirmWeighing } = usePembelian()
  const { selectedId, select, goTo } = useSelectedDoc()

  const waiting = purchases.filter((p) => p.stage === 'dicatat')
  const weighed = purchases.filter((p) => p.stage === 'ditimbang')
  const received = purchases.filter((p) => p.stage === 'diterima').map((p) => summarize(p).weighing)
  const receivedNetto = received.reduce((sum, w) => sum + (w?.netto ?? 0), 0)
  const receivedWeighed = received.reduce((sum, w) => sum + (w?.weighed ?? 0), 0)
  const avgRafaksi = receivedWeighed > 0 ? (1 - receivedNetto / receivedWeighed) * 100 : 0

  return (
    <div className="space-y-3">
      <PembelianSubnav />

      <StatStrip
        items={[
          {
            label: 'Antre timbang',
            value: `${waiting.length} dokumen`,
            hint: `± ${formatKg(waiting.reduce((sum, p) => sum + p.estimatedKg, 0))} taksiran`,
          },
          {
            label: 'Menunggu konfirmasi',
            value: `${weighed.length} dokumen`,
            hint: `${formatKg(weighed.reduce((sum, p) => sum + (summarize(p).weighing?.weighed ?? 0), 0))} sudah ditimbang`,
            tone: weighed.length > 0 ? 'warn' : 'default',
          },
          {
            label: 'Gabah diterima (netto)',
            value: formatKg(receivedNetto),
            hint: `${received.length} penerimaan dikonfirmasi`,
            tone: 'good',
          },
          {
            label: 'Rata-rata rafaksi',
            value: formatPercent(avgRafaksi),
            hint: 'potongan kadar air & hampa',
          },
        ]}
      />

      {/* Kunci pilihan setelah aksi, karena dokumen pindah kelompok antrean */}
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
    </div>
  )
}
