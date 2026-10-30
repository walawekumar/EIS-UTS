import { PengirimanView } from '@/components/penjualan/PengirimanView'
import { usePenjualan, useSelectedOrder } from '@/features/penjualan/PenjualanContext'

export function PengirimanPage() {
  const { orders, shipOrder } = usePenjualan()
  const { selectedId, select, goTo } = useSelectedOrder()

  return (
    <PengirimanView
      orders={orders}
      selectedId={selectedId}
      onSelect={select}
      onShip={(id, input) => {
        const result = shipOrder(id, input)
        if (result.ok) select(id)
        return result
      }}
      onGoTo={goTo}
    />
  )
}
