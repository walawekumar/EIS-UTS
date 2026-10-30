import { useState } from 'react'
import { OrderFormDrawer } from '@/components/penjualan/OrderFormDrawer'
import { OrderView } from '@/components/penjualan/OrderView'
import { usePenjualan, useSelectedOrder } from '@/features/penjualan/PenjualanContext'
import { nextOrderId } from '@/features/penjualan/penjualan-data'

export function OrderPage() {
  const { orders, createOrder, deleteOrder } = usePenjualan()
  const { selectedId, select, goTo } = useSelectedOrder()
  const [formOpen, setFormOpen] = useState(false)

  return (
    <>
      <OrderView
        orders={orders}
        selectedId={selectedId}
        onSelect={select}
        onCreate={() => setFormOpen(true)}
        onDelete={(id) => {
          deleteOrder(id)
          select(null)
        }}
        onGoTo={goTo}
      />

      <OrderFormDrawer
        open={formOpen}
        nextId={nextOrderId(orders)}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          const result = createOrder(data)
          if (!result.ok) {
            window.alert(result.error)
            return
          }
          setFormOpen(false)
          select(result.id)
        }}
      />
    </>
  )
}
