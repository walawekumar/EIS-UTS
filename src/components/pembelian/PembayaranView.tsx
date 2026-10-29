import { useMemo, useState, type FormEvent } from 'react'
import { PaymentLabel } from '@/components/pembelian/StatusLabel'
import {
  EmptyState,
  FilterDropdown,
  SearchInput,
  panelClass,
  primaryBtn,
  sectionLabel,
} from '@/components/pembelian/Toolbar'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import {
  PAYMENT_METHOD_LABEL,
  SUPPLIERS,
  formatDate,
  formatKg,
  formatRupiah,
  formatRupiahShort,
  getSupplier,
  parseNumber,
  summarize,
  todayIso,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type Purchase,
} from '@/features/pembelian/pembelian-data'

type PaymentFilter = 'semua' | 'belum-lunas' | 'terlambat' | 'lunas'

type PembayaranViewProps = {
  purchases: Purchase[]
  selectedId: string | null
  onSelect: (id: string) => void
  onPay: (id: string, payment: Omit<Payment, 'id'>) => void
}

const STATUS_ORDER: Record<PaymentStatus, number> = { terlambat: 0, belum: 1, sebagian: 2, lunas: 3 }

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()
  return Math.round(ms / 86_400_000)
}

function dueHint(due: string | undefined, status: PaymentStatus | null, today: string): string {
  if (!due || status === 'lunas') return ''
  const d = daysBetween(today, due)
  if (d < 0) return `lewat ${-d} hari`
  if (d === 0) return 'hari ini'
  return `${d} hari lagi`
}

export function PembayaranView({ purchases, selectedId, onSelect, onPay }: PembayaranViewProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PaymentFilter>('belum-lunas')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const today = todayIso()

  const payables = useMemo(
    () =>
      purchases
        .filter((p) => p.stage === 'diterima')
        .map((p) => ({ p, s: summarize(p, today) }))
        .sort((a, b) => {
          const byStatus = STATUS_ORDER[a.s.payment ?? 'lunas'] - STATUS_ORDER[b.s.payment ?? 'lunas']
          return byStatus !== 0 ? byStatus : (a.p.dueDate ?? '').localeCompare(b.p.dueDate ?? '')
        }),
    [purchases, today],
  )

  const bySupplier = SUPPLIERS.map((sup) => {
    const own = payables.filter((x) => x.p.supplierId === sup.id)
    const total = own.reduce((sum, x) => sum + x.s.total, 0)
    const outstanding = own.reduce((sum, x) => sum + x.s.outstanding, 0)
    return {
      supplier: sup,
      total,
      outstanding,
      openDocs: own.filter((x) => x.s.outstanding > 0).length,
      overdue: own.some((x) => x.s.payment === 'terlambat'),
    }
  })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.outstanding - a.outstanding)

  const matches = (status: PaymentStatus | null, f: PaymentFilter) =>
    f === 'semua' ||
    (f === 'lunas' && status === 'lunas') ||
    (f === 'terlambat' && status === 'terlambat') ||
    (f === 'belum-lunas' && status !== 'lunas')

  const q = query.trim().toLowerCase()
  const rows = payables
    .filter((x) => matches(x.s.payment, filter))
    .filter((x) => !supplierId || x.p.supplierId === supplierId)
    .filter((x) => {
      if (!q) return true
      const sup = getSupplier(x.p.supplierId)
      return [x.p.id, sup?.name].some((v) => v?.toLowerCase().includes(q))
    })

  // Tetap tampilkan tagihan terpilih walau baru lunas dan keluar dari filter
  const selected = payables.find((x) => x.p.id === selectedId) ?? rows[0] ?? null

  return (
    <div className="space-y-2.5">
      <section className={[panelClass, 'p-4'].join(' ')}>
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink">Utang per pemasok</h2>
          {supplierId ? (
            <button type="button" onClick={() => setSupplierId(null)} className="text-[12px] font-medium text-brand-800 hover:underline">
              Tampilkan semua pemasok
            </button>
          ) : (
            <span className="font-mono text-[11px] text-muted">klik untuk menyaring</span>
          )}
        </div>
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {bySupplier.map((x) => {
            const active = supplierId === x.supplier.id
            const paidPct = x.total > 0 ? ((x.total - x.outstanding) / x.total) * 100 : 0
            return (
              <button
                key={x.supplier.id}
                type="button"
                onClick={() => setSupplierId(active ? null : x.supplier.id)}
                className={[
                  'w-[200px] shrink-0 rounded-xl border px-3 py-2.5 text-left transition',
                  active ? 'border-brand-300 bg-brand-50' : 'border-line hover:border-brand-200 hover:bg-surface',
                ].join(' ')}
              >
                <p className="truncate text-[12px] font-medium text-ink">{x.supplier.name}</p>
                <p
                  className={[
                    'num mt-1 text-[15px] font-semibold',
                    x.overdue ? 'text-red-700' : x.outstanding > 0 ? 'text-ink' : 'text-brand-700',
                  ].join(' ')}
                >
                  {x.outstanding > 0 ? formatRupiahShort(x.outstanding) : 'Lunas'}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${paidPct}%` }} />
                </div>
                <p className="num mt-1 text-[11px] text-muted">
                  {x.openDocs > 0 ? `${x.openDocs} dokumen terbuka` : 'semua lunas'}
                  {x.overdue ? ' · ada yang telat' : ''}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid items-start gap-2.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className={[panelClass, 'p-4 sm:p-5'].join(' ')}>
          <div className="mb-3">
            <h2 className="text-[14px] font-semibold text-ink">Status pembayaran ke pemasok</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Utang muncul setelah berat dikonfirmasi. Jatuh tempo dihitung dari tanggal konfirmasi.
            </p>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <SearchInput fullWidth value={query} onChange={setQuery} placeholder="Cari dokumen atau pemasok…" />
            <FilterDropdown
              label="Status"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'belum-lunas', label: 'Belum lunas', tone: 'bg-amber-500', count: payables.filter((x) => matches(x.s.payment, 'belum-lunas')).length },
                { id: 'terlambat', label: 'Lewat jatuh tempo', tone: 'bg-red-600', count: payables.filter((x) => x.s.payment === 'terlambat').length },
                { id: 'lunas', label: 'Lunas', tone: 'bg-brand-600', count: payables.filter((x) => x.s.payment === 'lunas').length },
                { id: 'semua', label: 'Semua', tone: 'bg-slate-400', count: payables.length },
              ]}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Tidak ada tagihan yang cocok" hint="Ubah filter, pemasok, atau kata kunci." />
          ) : (
            <div className="scrollbar-none overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink/20 text-[11px] tracking-wide text-muted uppercase">
                    <th className="py-2 pr-3 pl-2 font-medium">Dokumen</th>
                    <th className="py-2 pr-3 font-medium">Pemasok</th>
                    <th className="py-2 pr-3 text-right font-medium">Total</th>
                    <th className="py-2 pr-3 text-right font-medium">Dibayar</th>
                    <th className="py-2 pr-3 text-right font-medium">Sisa</th>
                    <th className="py-2 pr-3 font-medium">Jatuh tempo</th>
                    <th className="py-2 pr-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, s }) => {
                    const active = p.id === selected?.p.id
                    return (
                      <tr
                        key={p.id}
                        tabIndex={0}
                        aria-selected={active}
                        onClick={() => onSelect(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelect(p.id)
                          }
                        }}
                        className={[
                          'cursor-pointer border-b border-line outline-none transition last:border-0 focus-visible:bg-brand-50',
                          active ? 'bg-brand-50' : 'hover:bg-surface',
                        ].join(' ')}
                      >
                        <td className="py-2.5 pr-3 pl-2">
                          <span className={['num block', active ? 'font-semibold text-brand-900' : 'text-ink'].join(' ')}>
                            {p.id}
                          </span>
                          <span className="num block text-[11px] text-muted">netto {formatKg(s.weighing?.netto ?? 0)}</span>
                        </td>
                        <td className="max-w-[180px] truncate py-2.5 pr-3 text-ink">{getSupplier(p.supplierId)?.name}</td>
                        <td className="num py-2.5 pr-3 text-right text-ink">{formatRupiah(s.total)}</td>
                        <td className="num py-2.5 pr-3 text-right text-muted">{formatRupiah(s.paid)}</td>
                        <td
                          className={[
                            'num py-2.5 pr-3 text-right',
                            s.outstanding === 0 ? 'text-muted' : s.payment === 'terlambat' ? 'font-semibold text-red-700' : 'font-semibold text-ink',
                          ].join(' ')}
                        >
                          {s.outstanding === 0 ? '—' : formatRupiah(s.outstanding)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="num block text-ink">{p.dueDate ? formatDate(p.dueDate) : '—'}</span>
                          <span
                            className={[
                              'num block text-[11px]',
                              s.payment === 'terlambat' ? 'text-red-700' : 'text-muted',
                            ].join(' ')}
                          >
                            {dueHint(p.dueDate, s.payment, today)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2">{s.payment ? <PaymentLabel status={s.payment} /> : null}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className={[panelClass, 'p-4 lg:sticky lg:top-0'].join(' ')}>
          {selected ? (
            <PaymentPanel key={selected.p.id} purchase={selected.p} today={today} onPay={(pay) => onPay(selected.p.id, pay)} />
          ) : (
            <EmptyState title="Pilih tagihan" hint="Rincian dan riwayat pembayaran tampil di sini." />
          )}
        </aside>
      </div>
    </div>
  )
}

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({
  value: m,
  label: PAYMENT_METHOD_LABEL[m],
}))

function PaymentPanel({
  purchase: p,
  today,
  onPay,
}: {
  purchase: Purchase
  today: string
  onPay: (payment: Omit<Payment, 'id'>) => void
}) {
  const s = summarize(p, today)
  const supplier = getSupplier(p.supplierId)
  const paidPct = s.total > 0 ? Math.min(100, (s.paid / s.total) * 100) : 0

  const [amount, setAmount] = useState(String(s.outstanding))
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseNumber(amount)
    if (value <= 0) return setError('Isi jumlah pembayaran')
    if (value > s.outstanding) return setError(`Maksimal ${formatRupiah(s.outstanding)}`)
    onPay({ amount: value, method, date })
    setAmount(String(Math.max(0, s.outstanding - value)))
    setError(undefined)
  }

  return (
    <section>
      <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
        <div className="min-w-0">
          <p className={sectionLabel}>Tagihan pemasok</p>
          <h3 className="num mt-1 text-[15px] font-semibold text-ink">{p.id}</h3>
          <p className="truncate text-[12px] text-muted">{supplier?.name}</p>
        </div>
        {s.payment ? <PaymentLabel status={s.payment} /> : null}
      </div>

      <div className="py-3">
        <p className="text-[12px] text-muted">Sisa utang</p>
        <p
          className={[
            'num mt-1 text-[24px] leading-none font-semibold tracking-tight',
            s.payment === 'terlambat' ? 'text-red-700' : s.outstanding === 0 ? 'text-brand-700' : 'text-ink',
          ].join(' ')}
        >
          {formatRupiah(s.outstanding)}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-50">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        <p className="num mt-1.5 text-[11px] text-muted">
          {Math.round(paidPct)}% dari {formatRupiah(s.total)} sudah dibayar
        </p>
      </div>

      <dl className="divide-y divide-line border-t border-line text-[13px]">
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Berat netto</dt>
          <dd className="num text-ink">{formatKg(s.weighing?.netto ?? 0)}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Harga</dt>
          <dd className="num text-ink">{formatRupiah(p.price)}/kg</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-muted">Jatuh tempo</dt>
          <dd className={['num', s.payment === 'terlambat' ? 'text-red-700' : 'text-ink'].join(' ')}>
            {p.dueDate ? formatDate(p.dueDate, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </dd>
        </div>
      </dl>

      <p className={[sectionLabel, 'mt-4 mb-2'].join(' ')}>Riwayat pembayaran</p>
      {p.payments.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-2.5 text-[12px] text-muted">Belum ada pembayaran.</p>
      ) : (
        <ul className="space-y-1.5">
          {p.payments.map((pay) => (
            <li key={pay.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2">
              <div className="min-w-0">
                <p className="num text-[12px] text-ink">{formatDate(pay.date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <p className="num text-[11px] text-muted">
                  {pay.id} · {PAYMENT_METHOD_LABEL[pay.method]}
                </p>
              </div>
              <span className="num text-[13px] font-semibold text-brand-800">{formatRupiah(pay.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {s.outstanding > 0 ? (
        <form onSubmit={submit} noValidate className="mt-4 space-y-3 border-t border-line pt-4">
          <p className={sectionLabel}>Catat pembayaran</p>
          <TextField
            id="by-amount"
            label="Jumlah (Rp)"
            requiredMark
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setError(undefined)
            }}
            error={error}
            trailing={
              <button
                type="button"
                onClick={() => setAmount(String(s.outstanding))}
                className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
              >
                Lunasi
              </button>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Metode" value={method} options={METHOD_OPTIONS} onChange={setMethod} />
            <TextField id="by-date" label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button type="submit" className={[primaryBtn, 'w-full'].join(' ')}>
            Simpan pembayaran
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-center text-[12px] text-brand-900">
          Tagihan ini sudah lunas.
        </p>
      )}
    </section>
  )
}
