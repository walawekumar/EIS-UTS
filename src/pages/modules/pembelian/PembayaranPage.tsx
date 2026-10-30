import { PembayaranView } from '@/components/pembelian/PembayaranView'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'

export function PembayaranPage() {
  const { purchases, addPayment } = usePembelian()
  const { selectedId, select } = useSelectedDoc()

  return (
    <PembayaranView
      purchases={purchases}
      selectedId={selectedId}
      onSelect={select}
      onPay={(id, payment) => {
        const err = addPayment(id, payment)
        select(id)
        return err
      }}
    />
  )
}
