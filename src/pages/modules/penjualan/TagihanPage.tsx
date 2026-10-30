import { TagihanView } from '@/components/penjualan/TagihanView'
import { usePenjualan, useSelectedOrder } from '@/features/penjualan/PenjualanContext'

export function TagihanPage() {
  const { orders, addPayment } = usePenjualan()
  const { selectedId, select } = useSelectedOrder()

  return (
    <TagihanView
      orders={orders}
      selectedId={selectedId}
      onSelect={select}
      onPay={(id, payment) => {
        addPayment(id, payment)
        select(id)
      }}
    />
  )
}
