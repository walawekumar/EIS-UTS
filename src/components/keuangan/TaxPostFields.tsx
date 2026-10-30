import { Select } from '@/components/ui/Select'
import { computePpn } from '@/features/keuangan/tax-compute'
import type { PpnRate, PriceMode } from '@/features/keuangan/tax-data'
import { formatIdr } from '@/features/keuangan/keuangan-data'

const RATE_OPTS = [
  { value: '11' as const, label: 'PPN 11%' },
  { value: '0' as const, label: 'PPN 0%' },
]

const MODE_OPTS = [
  {
    value: 'exclusive' as const,
    label: 'Harga exclusive (DPP + PPN)',
  },
  {
    value: 'inclusive' as const,
    label: 'Harga inclusive (sudah termasuk PPN)',
  },
]

export function TaxPostFields(props: {
  subtotal: number
  rate: PpnRate
  priceMode: PriceMode
  onRateChange: (r: PpnRate) => void
  onModeChange: (m: PriceMode) => void
}) {
  const calc = computePpn({
    subtotal: props.subtotal,
    rate: props.rate,
    priceMode: props.priceMode,
  })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label="Tarif PPN"
        value={String(props.rate) as '11' | '0'}
        options={RATE_OPTS}
        onChange={(v) => props.onRateChange(v === '0' ? 0 : 11)}
      />
      <Select
        label="Mode harga"
        value={props.priceMode}
        options={MODE_OPTS}
        onChange={(v) =>
          props.onModeChange(v === 'inclusive' ? 'inclusive' : 'exclusive')
        }
      />
      <p className="text-sm text-muted sm:col-span-2">
        DPP {formatIdr(calc.dpp)} · PPN {formatIdr(calc.ppn)} · Total{' '}
        {formatIdr(calc.total)}
      </p>
    </div>
  )
}
