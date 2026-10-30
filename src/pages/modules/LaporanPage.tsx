import { useMemo, useState } from 'react'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
} from '@/components/keuangan/FinanceTable'
import { downloadCsv } from '@/features/persediaan/persediaan-utils'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { usePembelian } from '@/features/pembelian/PembelianContext'
import {
  formatRupiah,
  isPurchaseReceivedForAp,
  summarize as sumPurchase,
} from '@/features/pembelian/pembelian-data'
import { usePenjualan } from '@/features/penjualan/PenjualanContext'
import { summarize as sumSale } from '@/features/penjualan/penjualan-data'
import { usePersediaanStore } from '@/features/persediaan/persediaan-store'
import { isLowStock } from '@/features/persediaan/persediaan-data'
import { useProduksi } from '@/features/produksi/ProduksiContext'
import { actualRendemen, type LotCost } from '@/features/produksi/produksi-data'
import { downloadBackup } from '@/features/backup/backup'

type Tab = 'ringkas' | 'aging' | 'stok' | 'produksi'

function idr(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function LaporanPage() {
  const { cashEntries, payables, receivables, expenses } = useFinanceStore()
  const { purchases } = usePembelian()
  const { orders } = usePenjualan()
  const { stocks } = usePersediaanStore()
  const { batches, lotCosts } = useProduksi()
  const [tab, setTab] = useState<Tab>('ringkas')
  const [toast, setToast] = useState<string | null>(null)

  const buy = purchases
    .filter((p) => isPurchaseReceivedForAp(p.stage) && !p.voidedAt)
    .reduce((s, p) => s + sumPurchase(p).total, 0)
  const sell = orders
    .filter((o) => o.stage === 'dikirim' && !o.voidedAt)
    .reduce((s, o) => s + sumSale(o).total, 0)
  const ap = payables
    .filter((p) => p.paid < p.amount)
    .reduce((s, p) => s + (p.amount - p.paid), 0)
  const ar = receivables
    .filter((r) => r.paid < r.amount)
    .reduce((s, r) => s + (r.amount - r.paid), 0)
  const expensePosted = expenses
    .filter((e) => e.status === 'posted')
    .reduce((s, e) => s + e.amount, 0)
  const cashBal = cashEntries[0]?.balance ?? 0
  const low = stocks.filter(isLowStock)

  const purchaseByLotId = useMemo(() => {
    const map = new Map<string, (typeof purchases)[number]>()
    for (const p of purchases) {
      if (p.lotId) map.set(p.lotId, p)
    }
    return map
  }, [purchases])

  const batchById = useMemo(() => {
    const map = new Map<string, (typeof batches)[number]>()
    for (const b of batches) map.set(b.id, b)
    return map
  }, [batches])

  const costingRows = useMemo(() => {
    const latestByLot = new Map<string, LotCost>()
    for (const row of lotCosts) {
      const prev = latestByLot.get(row.lotId)
      if (!prev || row.at.localeCompare(prev.at) > 0) latestByLot.set(row.lotId, row)
    }
    return [...latestByLot.values()].sort((a, b) => b.at.localeCompare(a.at))
  }, [lotCosts])

  const stats = useMemo(
    () => [
      {
        label: 'Omzet terkirim',
        value: idr(sell),
        delta: `${orders.filter((o) => o.stage === 'dikirim').length} order`,
        positive: true,
        spark: [2, 3, 4, 5, 5, 6, 7],
      },
      {
        label: 'Pembelian diterima',
        value: idr(buy),
        delta: 'netto × harga efektif',
        positive: true,
        spark: [3, 3, 4, 4, 5, 5, 6],
      },
      {
        label: 'Laba kotor kasar',
        value: idr(sell - buy),
        delta: 'jual − beli',
        positive: sell >= buy,
        spark: [1, 2, 2, 3, 3, 4, 4],
      },
      {
        label: 'Saldo kas',
        value: idr(cashBal),
        delta: `Biaya posted ${idr(expensePosted)}`,
        positive: cashBal >= 0,
        spark: [5, 5, 6, 6, 7, 7, 8],
      },
    ],
    [sell, buy, cashBal, expensePosted, orders],
  )

  function exportRingkas() {
    downloadCsv(
      `laporan-ringkas-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Metrik', 'Nilai'],
      [
        ['Omzet', sell],
        ['Pembelian', buy],
        ['Laba kotor kasar', sell - buy],
        ['Kas', cashBal],
        ['Utang terbuka', ap],
        ['Piutang terbuka', ar],
        ['Stok rendah', low.length],
      ],
    )
    setToast('CSV ringkas diunduh')
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />
      <FinanceToast message={toast} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ringkas', 'Ringkas'],
                ['aging', 'Aging AR/AP'],
                ['stok', 'Stok rendah'],
                ['produksi', 'Rendemen'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={[
                  'h-9 rounded-xl px-3 text-[12.5px] font-medium transition',
                  tab === id
                    ? 'bg-brand-800 text-white'
                    : 'border border-line text-muted hover:bg-surface',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportRingkas}
              className="h-9 rounded-xl border border-line px-3 text-[12.5px] font-medium text-ink hover:bg-surface"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                downloadBackup()
                setToast('Backup JSON diunduh')
              }}
              className="h-9 rounded-xl bg-brand-800 px-3 text-[12.5px] font-semibold text-white hover:bg-brand-900"
            >
              Backup JSON
            </button>
          </div>
        </div>

        {tab === 'ringkas' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line/80 bg-surface/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                AR / AP
              </p>
              <p className="mt-2 text-[14px] text-ink">
                Piutang terbuka: <span className="font-semibold">{idr(ar)}</span>
              </p>
              <p className="text-[14px] text-ink">
                Utang terbuka: <span className="font-semibold">{idr(ap)}</span>
              </p>
            </div>
            <div className="rounded-xl border border-line/80 bg-surface/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Operasional
              </p>
              <p className="mt-2 text-[14px] text-ink">
                Stok rendah: <span className="font-semibold">{low.length}</span>
              </p>
              <p className="text-[14px] text-ink">
                Batch selesai:{' '}
                <span className="font-semibold">
                  {batches.filter((b) => b.stage === 'done').length}
                </span>
              </p>
            </div>
          </div>
        ) : null}

        {tab === 'aging' ? (
          <FinanceTable>
            <FinanceThead>
              <FinanceTh>Jenis</FinanceTh>
              <FinanceTh>Mitra</FinanceTh>
              <FinanceTh>Invoice</FinanceTh>
              <FinanceTh>Sisa</FinanceTh>
              <FinanceTh>Aging</FinanceTh>
              <FinanceTh>Status</FinanceTh>
            </FinanceThead>
            <tbody>
              {[
                ...payables
                  .filter((p) => p.paid < p.amount)
                  .map((p) => ({
                    kind: 'Utang',
                    party: p.supplier,
                    invoice: p.invoice,
                    sisa: p.amount - p.paid,
                    aging: p.agingDays,
                    status: p.status,
                  })),
                ...receivables
                  .filter((r) => r.paid < r.amount)
                  .map((r) => ({
                    kind: 'Piutang',
                    party: r.customer,
                    invoice: r.invoice,
                    sisa: r.amount - r.paid,
                    aging: r.agingDays,
                    status: r.status,
                  })),
              ].map((row) => (
                <FinanceTr key={`${row.kind}-${row.invoice}`}>
                  <FinanceTd>{row.kind}</FinanceTd>
                  <FinanceTd>{row.party}</FinanceTd>
                  <FinanceTd mono>{row.invoice}</FinanceTd>
                  <FinanceTd mono>{idr(row.sisa)}</FinanceTd>
                  <FinanceTd mono>{row.aging}h</FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={row.status}
                      tone={row.status === 'overdue' ? 'danger' : 'warn'}
                    />
                  </FinanceTd>
                </FinanceTr>
              ))}
            </tbody>
          </FinanceTable>
        ) : null}

        {tab === 'stok' ? (
          <FinanceTable>
            <FinanceThead>
              <FinanceTh>SKU</FinanceTh>
              <FinanceTh>Nama</FinanceTh>
              <FinanceTh>Lokasi</FinanceTh>
              <FinanceTh>Qty</FinanceTh>
              <FinanceTh>Min</FinanceTh>
            </FinanceThead>
            <tbody>
              {low.length === 0 ? (
                <FinanceEmptyRow colSpan={5} message="Tidak ada stok rendah." />
              ) : (
                low.map((s) => (
                  <FinanceTr key={`${s.sku}-${s.location}`}>
                    <FinanceTd mono>{s.sku}</FinanceTd>
                    <FinanceTd>{s.name}</FinanceTd>
                    <FinanceTd>{s.location}</FinanceTd>
                    <FinanceTd mono>
                      {s.qty} {s.unit}
                    </FinanceTd>
                    <FinanceTd mono>{s.minQty}</FinanceTd>
                  </FinanceTr>
                ))
              )}
            </tbody>
          </FinanceTable>
        ) : null}

        {tab === 'produksi' ? (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ink">Rendemen batch</h3>
              <FinanceTable>
                <FinanceThead>
                  <FinanceTh>Batch</FinanceTh>
                  <FinanceTh>Target</FinanceTh>
                  <FinanceTh>Aktual</FinanceTh>
                  <FinanceTh>Δ</FinanceTh>
                  <FinanceTh>Status</FinanceTh>
                </FinanceThead>
                <tbody>
                  {batches.map((b) => {
                    const act = actualRendemen(b)
                    const d = act - b.targetRendemen
                    return (
                      <FinanceTr key={b.id}>
                        <FinanceTd mono>{b.id}</FinanceTd>
                        <FinanceTd mono>{b.targetRendemen.toFixed(1)}%</FinanceTd>
                        <FinanceTd mono>{act.toFixed(1)}%</FinanceTd>
                        <FinanceTd>
                          <StatusPill
                            label={`${d >= 0 ? '+' : ''}${d.toFixed(1)}`}
                            tone={d >= 0 ? 'good' : 'warn'}
                          />
                        </FinanceTd>
                        <FinanceTd>{b.stage}</FinanceTd>
                      </FinanceTr>
                    )
                  })}
                </tbody>
              </FinanceTable>
            </div>

            <div>
              <h3 className="mb-0.5 text-[13px] font-semibold text-ink">
                Costing & rendemen per lot
              </h3>
              <p className="mb-2 text-[12px] text-muted">
                Snapshot biaya/kg beras terakhir per lot (gabah + alokasi ops)
              </p>
              <FinanceTable>
                <FinanceThead>
                  <FinanceTh>Lot</FinanceTh>
                  <FinanceTh>Batch</FinanceTh>
                  <FinanceTh>PO / pemasok</FinanceTh>
                  <FinanceTh>Rendemen</FinanceTh>
                  <FinanceTh>Cost/kg</FinanceTh>
                  <FinanceTh>Nilai gabah</FinanceTh>
                  <FinanceTh>Alokasi ops</FinanceTh>
                  <FinanceTh>Metode</FinanceTh>
                </FinanceThead>
                <tbody>
                  {costingRows.length === 0 ? (
                    <FinanceEmptyRow
                      colSpan={8}
                      message="Belum ada snapshot costing. Selesaikan batch atau hitung ulang di Rendemen."
                    />
                  ) : (
                    costingRows.map((row) => {
                      const batch = batchById.get(row.batchId)
                      const purchase = purchaseByLotId.get(row.lotId)
                      const act = batch ? actualRendemen(batch) : null
                      return (
                        <FinanceTr key={`${row.lotId}-${row.batchId}-${row.at}`}>
                          <FinanceTd mono>{row.lotId}</FinanceTd>
                          <FinanceTd mono>{row.batchId}</FinanceTd>
                          <FinanceTd>
                            {purchase ? (
                              <>
                                <p className="font-medium text-ink">{purchase.id}</p>
                                <p className="text-[11px] text-muted">{purchase.supplier}</p>
                              </>
                            ) : (
                              '—'
                            )}
                          </FinanceTd>
                          <FinanceTd mono>
                            {act != null ? `${act.toFixed(1)}%` : '—'}
                          </FinanceTd>
                          <FinanceTd mono>
                            {row.costPerKgBeras > 0
                              ? formatRupiah(row.costPerKgBeras)
                              : '—'}
                          </FinanceTd>
                          <FinanceTd mono>{formatRupiah(row.grainValue)}</FinanceTd>
                          <FinanceTd mono>{formatRupiah(row.allocatedOps)}</FinanceTd>
                          <FinanceTd>
                            {row.method === 'manual' ? 'Manual' : 'Proporsional'}
                          </FinanceTd>
                        </FinanceTr>
                      )
                    })
                  )}
                </tbody>
              </FinanceTable>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
