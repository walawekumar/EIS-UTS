import { PembayaranView } from '@/components/pembelian/PembayaranView'
import { PembelianSubnav } from '@/components/pembelian/PembelianSubnav'
import { StatStrip } from '@/components/pembelian/StatStrip'
import { usePembelian, useSelectedDoc } from '@/features/pembelian/PembelianContext'
import {
  addDays,
  formatRupiahShort,
  summarize,
  todayIso,
} from '@/features/pembelian/pembelian-data'

export function PembayaranPage() {
  const { purchases, addPayment } = usePembelian()
  const { selectedId, select } = useSelectedDoc()

  const today = todayIso()
  const weekAhead = addDays(today, 7)
  const bills = purchases
    .filter((p) => p.stage === 'diterima')
    .map((p) => ({ p, s: summarize(p, today) }))
  const open = bills.filter((x) => x.s.outstanding > 0)
  const overdue = open.filter((x) => x.s.payment === 'terlambat')
  const dueSoon = open.filter((x) => x.s.payment !== 'terlambat' && (x.p.dueDate ?? '') <= weekAhead)
  const sum = (list: typeof bills, key: 'outstanding' | 'paid') =>
    list.reduce((total, x) => total + x.s[key], 0)

  return (
    <div className="space-y-3">
      <PembelianSubnav />

      <StatStrip
        items={[
          {
            label: 'Total utang pemasok',
            value: formatRupiahShort(sum(open, 'outstanding')),
            hint: `${open.length} tagihan terbuka`,
          },
          {
            label: 'Lewat jatuh tempo',
            value: formatRupiahShort(sum(overdue, 'outstanding')),
            hint: `${overdue.length} tagihan perlu segera dibayar`,
            tone: overdue.length > 0 ? 'danger' : 'default',
          },
          {
            label: 'Jatuh tempo 7 hari',
            value: formatRupiahShort(sum(dueSoon, 'outstanding')),
            hint: `${dueSoon.length} tagihan`,
            tone: dueSoon.length > 0 ? 'warn' : 'default',
          },
          {
            label: 'Sudah dibayar',
            value: formatRupiahShort(sum(bills, 'paid')),
            hint: `${bills.reduce((n, x) => n + x.p.payments.length, 0)} transaksi pembayaran`,
            tone: 'good',
          },
        ]}
      />

      <PembayaranView
        purchases={purchases}
        selectedId={selectedId}
        onSelect={select}
        onPay={(id, payment) => {
          addPayment(id, payment)
          select(id)
        }}
      />
    </div>
  )
}
