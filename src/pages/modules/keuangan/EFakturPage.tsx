import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  FinanceModal,
  ModalActions,
} from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
import {
  FinanceEmptyRow,
  FinanceSortTh,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
  rowNumber,
  sortBy,
  toggleSort,
  type SortState,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { buildEfakturCsv } from '@/features/keuangan/tax-csv'
import type {
  PpnRate,
  PriceMode,
  TaxInvoice,
  TaxInvoiceStatus,
  TaxSettings,
} from '@/features/keuangan/tax-data'
import { formatIdr } from '@/features/keuangan/keuangan-data'
import { useTaxStore } from '@/features/keuangan/tax-store'
import { usePageSize } from '@/features/settings/usePageSize'

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Terkirim' },
  { value: 'failed', label: 'Gagal' },
  { value: 'void', label: 'Void' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

const STATUS_LABEL: Record<TaxInvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  failed: 'Gagal',
  void: 'Void',
}

const STATUS_TONE: Record<
  TaxInvoiceStatus,
  'neutral' | 'good' | 'warn' | 'muted' | 'danger'
> = {
  draft: 'warn',
  sent: 'good',
  failed: 'danger',
  void: 'muted',
}

type EfakturSortKey = 'date' | 'number' | 'party' | 'total' | 'status'

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

function formatInvoiceDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function downloadEfakturCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `efaktur-${todayYmd()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function canSendMock(inv: TaxInvoice): boolean {
  return inv.status === 'draft' || inv.status === 'failed'
}

function settingsDraftFrom(settings: TaxSettings): TaxSettings {
  return {
    npwp: settings.npwp,
    invoicePrefix: settings.invoicePrefix,
    nextSeq: settings.nextSeq,
    defaultRate: settings.defaultRate,
    defaultPriceMode: settings.defaultPriceMode,
  }
}

export function EFakturPage() {
  const PAGE_SIZE = usePageSize()
  const { settings, invoices, updateSettings, sendInvoiceMock } = useTaxStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<EfakturSortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaxInvoice | null>(null)
  const [sendTarget, setSendTarget] = useState<TaxInvoice | null>(null)
  const [simulateFail, setSimulateFail] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<TaxSettings>(() =>
    settingsDraftFrom(settings),
  )

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!detail) return
    const fresh = invoices.find((i) => i.id === detail.id)
    if (fresh) setDetail(fresh)
  }, [invoices, detail])

  useEffect(() => {
    if (!settingsOpen) return
    setSettingsDraft(settingsDraftFrom(settings))
  }, [settingsOpen, settings])

  useEffect(() => {
    if (!sendTarget) return
    setSimulateFail(false)
  }, [sendTarget])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false
      if (dateFrom && inv.date < dateFrom) return false
      if (dateTo && inv.date > dateTo) return false
      if (!q) return true
      return (
        inv.number.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        (inv.partyName ?? '').toLowerCase().includes(q) ||
        inv.saleOrderId.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      date: (r) => r.date,
      number: (r) => r.number,
      party: (r) => r.partyName ?? '',
      total: (r) => r.total,
      status: (r) => r.status,
    })
  }, [invoices, search, statusFilter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: EfakturSortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function exportCsv() {
    const csv = buildEfakturCsv(invoices, settings)
    downloadEfakturCsv(csv)
    setToast('CSV e-Faktur diunduh')
  }

  function saveSettings() {
    updateSettings({
      npwp: settingsDraft.npwp.trim(),
      invoicePrefix: settingsDraft.invoicePrefix.trim() || 'FP',
      defaultRate: settingsDraft.defaultRate,
      defaultPriceMode: settingsDraft.defaultPriceMode,
    })
    setSettingsOpen(false)
    setToast('Pengaturan pajak disimpan')
  }

  function confirmSendMock() {
    if (!sendTarget) return
    const err = sendInvoiceMock(sendTarget.id, { simulateFail })
    if (err) {
      setToast(err)
    } else if (simulateFail) {
      setToast(`Faktur ${sendTarget.number} gagal (simulasi)`)
    } else {
      setToast(`Faktur ${sendTarget.number} terkirim (mock)`)
    }
    setSendTarget(null)
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">e-Faktur (mock)</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Faktur pajak penjualan, kirim mock, dan export CSV latihan
            </p>
            {settings.npwp ? (
              <p className="mt-1 text-[11px] text-muted">
                NPWP {settings.npwp} · Prefix {settings.invoicePrefix}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-amber-800">
                NPWP belum diisi — buka pengaturan pajak
              </p>
            )}
          </div>
          <FinanceToast message={toast} />
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari nomor, pelanggan, order…"
          filter={statusFilter}
          filterOptions={STATUS_FILTERS}
          onFilterChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          filterLabel="Filter status"
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(v) => {
            setDateFrom(v)
            setPage(1)
          }}
          onDateToChange={(v) => {
            setDateTo(v)
            setPage(1)
          }}
          secondaryActionLabel="Pengaturan pajak"
          onSecondaryAction={() => setSettingsOpen(true)}
          actionLabel="Export CSV"
          onAction={exportCsv}
        />

        <FinanceTable minWidth="880px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Nomor faktur"
              sortKey="number"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Tanggal"
              sortKey="date"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Lawan transaksi"
              sortKey="party"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="right">DPP</FinanceTh>
            <FinanceTh align="right">PPN</FinanceTh>
            <FinanceSortTh
              label="Total"
              sortKey="total"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center" className="w-16">
              Detail
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={9}
                message="Belum ada faktur pajak yang cocok."
              />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {row.number}
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {formatInvoiceDate(row.date)}
                  </FinanceTd>
                  <FinanceTd className="max-w-[180px] truncate">
                    {row.partyName ?? ','}
                  </FinanceTd>
                  <FinanceTd align="right" mono>
                    {formatIdr(row.dpp)}
                  </FinanceTd>
                  <FinanceTd align="right" mono>
                    {formatIdr(row.ppn)}
                  </FinanceTd>
                  <FinanceTd align="right" mono className="font-medium">
                    {formatIdr(row.total)}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={STATUS_LABEL[row.status]}
                      tone={STATUS_TONE[row.status]}
                    />
                  </FinanceTd>
                  <FinanceTd align="center">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                      aria-label={`Detail ${row.number}`}
                      title="Detail"
                    >
                      <EyeIcon className="size-[18px]" />
                    </button>
                  </FinanceTd>
                </FinanceTr>
              ))
            )}
          </tbody>
        </FinanceTable>

        <FinancePager
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </section>

      {detail ? (
        <DetailDrawer
          open
          onClose={() => setDetail(null)}
          title={detail.number}
          subtitle={formatInvoiceDate(detail.date)}
          badge={
            <StatusPill
              label={STATUS_LABEL[detail.status]}
              tone={STATUS_TONE[detail.status]}
            />
          }
          footer={
            canSendMock(detail) ? (
              <button
                type="button"
                onClick={() => setSendTarget(detail)}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Kirim mock
              </button>
            ) : null
          }
        >
          <DrawerSection label="Ringkasan">
            <dl className="grid gap-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Pelanggan</dt>
                <dd className="text-right text-ink">
                  {detail.partyName ?? ','}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Order penjualan</dt>
                <dd className="num text-right text-ink">{detail.saleOrderId}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">DPP</dt>
                <dd className="num text-right text-ink">
                  {formatIdr(detail.dpp)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">PPN</dt>
                <dd className="num text-right text-ink">
                  {formatIdr(detail.ppn)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Total</dt>
                <dd className="num text-right font-medium text-ink">
                  {formatIdr(detail.total)}
                </dd>
              </div>
              {detail.sentAt ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Terkirim</dt>
                  <dd className="text-right text-ink">
                    {formatInvoiceDate(detail.sentAt.slice(0, 10))}
                  </dd>
                </div>
              ) : null}
              {detail.failReason ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Alasan gagal</dt>
                  <dd className="text-right text-red-800">{detail.failReason}</dd>
                </div>
              ) : null}
            </dl>
          </DrawerSection>
        </DetailDrawer>
      ) : null}

      {settingsOpen ? (
        <DetailDrawer
          open
          onClose={() => setSettingsOpen(false)}
          title="Pengaturan pajak"
          subtitle="Default form & export CSV e-Faktur"
          footer={
            <button
              type="button"
              onClick={saveSettings}
              className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
            >
              Simpan
            </button>
          }
        >
          <DrawerSection label="Identitas & default">
            <div className="grid gap-3">
              <TextField
                id="tax-npwp"
                label="NPWP"
                placeholder="00.000.000.0-000.000"
                value={settingsDraft.npwp}
                onChange={(e) =>
                  setSettingsDraft((d) => ({ ...d, npwp: e.target.value }))
                }
              />
              <TextField
                id="tax-prefix"
                label="Prefix nomor faktur"
                placeholder="FP"
                value={settingsDraft.invoicePrefix}
                onChange={(e) =>
                  setSettingsDraft((d) => ({
                    ...d,
                    invoicePrefix: e.target.value,
                  }))
                }
              />
              <Select
                label="Tarif PPN default"
                value={String(settingsDraft.defaultRate) as '11' | '0'}
                options={RATE_OPTS}
                onChange={(v) =>
                  setSettingsDraft((d) => ({
                    ...d,
                    defaultRate: (v === '0' ? 0 : 11) as PpnRate,
                  }))
                }
              />
              <Select
                label="Mode harga default"
                value={settingsDraft.defaultPriceMode}
                options={MODE_OPTS}
                onChange={(v) =>
                  setSettingsDraft((d) => ({
                    ...d,
                    defaultPriceMode: (v === 'inclusive'
                      ? 'inclusive'
                      : 'exclusive') as PriceMode,
                  }))
                }
              />
              <p className="text-[12px] text-muted">
                Urutan berikutnya: {settings.nextSeq} (otomatis saat faktur baru)
              </p>
            </div>
          </DrawerSection>
        </DetailDrawer>
      ) : null}

      {sendTarget ? (
        <FinanceModal
          title="Kirim mock ke e-Faktur?"
          subtitle="Konfirmasi"
          onClose={() => setSendTarget(null)}
          footer={
            <ModalActions
              onCancel={() => setSendTarget(null)}
              onConfirm={confirmSendMock}
              confirmLabel="Kirim"
            />
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            Faktur {sendTarget.number} akan ditandai terkirim (mock). Tidak ada
            koneksi ke Coretax/DJP nyata.
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-line text-brand-800"
              checked={simulateFail}
              onChange={(e) => setSimulateFail(e.target.checked)}
            />
            <span className="text-[13px] text-ink">Simulasikan gagal</span>
          </label>
        </FinanceModal>
      ) : null}
    </div>
  )
}
