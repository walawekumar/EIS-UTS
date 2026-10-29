import { useMemo, useState } from 'react'
import { GrainLabel, StageLabel } from '@/components/pembelian/StatusLabel'
import {
  EmptyState,
  FilterPills,
  SearchInput,
  panelClass,
  primaryBtn,
  secondaryBtn,
  sectionLabel,
} from '@/components/pembelian/Toolbar'
import {
  GRAIN_STANDARD,
  formatDate,
  formatKg,
  formatNumber,
  formatRupiah,
  getSupplier,
  summarize,
  type Purchase,
  type PurchaseStage,
} from '@/features/pembelian/pembelian-data'

type StageFilter = 'semua' | PurchaseStage

type PencatatanViewProps = {
  purchases: Purchase[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onGoTo: (tab: 'penerimaan' | 'pembayaran', id: string) => void
}

export function PencatatanView({
  purchases,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onGoTo,
}: PencatatanViewProps) {
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<StageFilter>('semua')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return purchases
      .filter((p) => stage === 'semua' || p.stage === stage)
      .filter((p) => {
        if (!q) return true
        const s = getSupplier(p.supplierId)
        return [p.id, s?.name, s?.village, p.vehicle].some((v) => v?.toLowerCase().includes(q))
      })
  }, [purchases, query, stage])

  const count = (s: PurchaseStage) => purchases.filter((p) => p.stage === s).length
  const selected = rows.find((p) => p.id === selectedId) ?? rows[0] ?? null

  return (
    <div className="grid items-start gap-2.5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className={[panelClass, 'p-4 sm:p-5'].join(' ')}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Catatan pembelian gabah</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Setiap gabah yang dibeli dicatat dulu dengan taksiran berat dan harga sepakat.
            </p>
          </div>
          <button type="button" onClick={onCreate} className={primaryBtn}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Catat pembelian
          </button>
        </div>

        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Cari dokumen, pemasok, no. polisi…" />
          <FilterPills
            value={stage}
            onChange={setStage}
            options={[
              { id: 'semua', label: 'Semua', count: purchases.length },
              { id: 'dicatat', label: 'Belum ditimbang', count: count('dicatat') },
              { id: 'ditimbang', label: 'Menunggu konfirmasi', count: count('ditimbang') },
              { id: 'diterima', label: 'Diterima', count: count('diterima') },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Tidak ada catatan yang cocok" hint="Ubah filter atau kata kunci pencarian." />
        ) : (
          <div className="scrollbar-none overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/20 text-[11px] tracking-wide text-muted uppercase">
                  <th className="py-2 pr-3 pl-2 font-medium">Dokumen</th>
                  <th className="py-2 pr-3 font-medium">Pemasok</th>
                  <th className="py-2 pr-3 font-medium">Jenis</th>
                  <th className="py-2 pr-3 text-right font-medium">Karung</th>
                  <th className="py-2 pr-3 text-right font-medium">Taksiran</th>
                  <th className="py-2 pr-3 text-right font-medium">Harga/kg</th>
                  <th className="py-2 pr-3 text-right font-medium">Nilai</th>
                  <th className="py-2 pr-2 font-medium">Tahap</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const s = summarize(p)
                  const supplier = getSupplier(p.supplierId)
                  const active = p.id === selected?.id
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
                        <span className="num block text-[11px] text-muted">{formatDate(p.date)}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="block max-w-[190px] truncate text-ink">{supplier?.name}</span>
                        <span className="block max-w-[190px] truncate text-[11px] text-muted">{supplier?.village}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <GrainLabel grain={p.grain} />
                      </td>
                      <td className="num py-2.5 pr-3 text-right text-ink">{p.sacks}</td>
                      <td className="num py-2.5 pr-3 text-right text-ink">{formatKg(p.estimatedKg)}</td>
                      <td className="num py-2.5 pr-3 text-right text-muted">{formatNumber(p.price)}</td>
                      <td className="num py-2.5 pr-3 text-right text-ink">
                        {p.stage === 'diterima' ? (
                          formatRupiah(s.total)
                        ) : (
                          <span className="text-muted" title="Nilai taksiran">
                            ± {formatRupiah(s.estimatedValue)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-2">
                        <StageLabel stage={p.stage} />
                      </td>
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
          <PurchaseRecordDetail purchase={selected} onDelete={onDelete} onGoTo={onGoTo} />
        ) : (
          <EmptyState title="Belum ada catatan" hint="Klik “Catat pembelian” untuk memulai." />
        )}
      </aside>
    </div>
  )
}

function PurchaseRecordDetail({
  purchase: p,
  onDelete,
  onGoTo,
}: {
  purchase: Purchase
  onDelete: (id: string) => void
  onGoTo: (tab: 'penerimaan' | 'pembayaran', id: string) => void
}) {
  const s = summarize(p)
  const supplier = getSupplier(p.supplierId)
  const lastPayment = p.payments.at(-1)

  const steps = [
    { label: 'Pembelian dicatat', meta: formatDate(p.date, { day: 'numeric', month: 'long' }), done: true },
    {
      label: 'Gabah ditimbang',
      meta: p.weighing ? `${formatDate(p.weighing.weighedAt)} · ${formatKg(s.weighing?.weighed ?? 0)}` : 'Menunggu gabah datang',
      done: Boolean(p.weighing),
    },
    {
      label: 'Berat dikonfirmasi',
      meta: p.weighing?.confirmedAt
        ? `${formatDate(p.weighing.confirmedAt)} · netto ${formatKg(s.weighing?.netto ?? 0)}`
        : 'Belum dikonfirmasi',
      done: p.stage === 'diterima',
    },
    {
      label: 'Pemasok dibayar lunas',
      meta:
        s.payment === 'lunas' && lastPayment
          ? formatDate(lastPayment.date, { day: 'numeric', month: 'long' })
          : p.stage === 'diterima'
            ? `Sisa ${formatRupiah(s.outstanding)}`
            : 'Setelah berat dikonfirmasi',
      done: s.payment === 'lunas',
    },
  ]
  const current = steps.findIndex((step) => !step.done)

  return (
    <section>
      <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
        <div className="min-w-0">
          <p className={sectionLabel}>Catatan pembelian</p>
          <h3 className="num mt-1 text-[15px] font-semibold text-ink">{p.id}</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {formatDate(p.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <StageLabel stage={p.stage} />
      </div>

      <div className="border-b border-line py-3">
        <p className="text-[13px] font-medium text-ink">{supplier?.name}</p>
        <p className="text-[12px] text-muted">{supplier?.village}</p>
      </div>

      <dl className="divide-y divide-line text-[13px]">
        {[
          ['Jenis gabah', `${p.grain} · ${GRAIN_STANDARD[p.grain].label}`],
          ['Jumlah karung', `${p.sacks} karung`],
          ['Taksiran berat', formatKg(p.estimatedKg)],
          ['Harga sepakat', `${formatRupiah(p.price)}/kg`],
          ['Nilai taksiran', formatRupiah(s.estimatedValue)],
          ...(p.vehicle ? [['Kendaraan', p.vehicle]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="shrink-0 text-muted">{label}</dt>
            <dd className="num truncate text-right text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {p.note ? (
        <p className="mt-1 rounded-xl bg-surface px-3 py-2 text-[12px] text-ink">{p.note}</p>
      ) : null}

      <p className={[sectionLabel, 'mt-4 mb-2'].join(' ')}>Alur dokumen</p>
      <ol>
        {steps.map((step, i) => {
          const isCurrent = i === current
          return (
            <li key={step.label} className="relative flex gap-3 pb-3 last:pb-0">
              {i < steps.length - 1 ? (
                <span
                  className={[
                    'absolute top-6 bottom-0 left-[11px] w-px',
                    step.done ? 'bg-brand-300' : 'bg-line',
                  ].join(' ')}
                />
              ) : null}
              <span
                className={[
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  step.done
                    ? 'bg-brand-700 text-white'
                    : isCurrent
                      ? 'border-2 border-brand-600 bg-white text-brand-800'
                      : 'border border-line bg-white text-muted',
                ].join(' ')}
              >
                {step.done ? (
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 12 4.5 4.5L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={['text-[13px]', step.done || isCurrent ? 'font-medium text-ink' : 'text-muted'].join(' ')}>
                  {step.label}
                </p>
                <p className="num text-[11px] text-muted">{step.meta}</p>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-4 grid gap-2">
        {p.stage !== 'diterima' ? (
          <button type="button" className={primaryBtn} onClick={() => onGoTo('penerimaan', p.id)}>
            {p.stage === 'dicatat' ? 'Timbang di penerimaan' : 'Konfirmasi berat'} →
          </button>
        ) : (
          <button type="button" className={primaryBtn} onClick={() => onGoTo('pembayaran', p.id)}>
            Lihat status pembayaran →
          </button>
        )}
        {p.stage === 'dicatat' ? (
          <button
            type="button"
            className={[secondaryBtn, 'text-red-700 hover:border-red-200 hover:bg-red-50 hover:text-red-800'].join(' ')}
            onClick={() => onDelete(p.id)}
          >
            Batalkan catatan
          </button>
        ) : null}
      </div>
    </section>
  )
}
