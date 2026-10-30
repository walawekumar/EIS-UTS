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
        const err = shipOrder(id, input)
        if (!err) select(id)
        return err
      }}
      onGoTo={goTo}
    />
  )
}
