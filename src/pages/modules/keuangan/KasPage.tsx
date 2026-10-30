import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  FinanceModal,
  ModalActions,
  TextAreaField,
} from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import {
  ActorCell,
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceSortTh,
  FinanceThead,
  FinanceTr,
  rowNumber,
  sortBy,
  toggleSort,
  type SortState,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import {
  ReceiptUpload,
  receiptPersistRef,
  type ReceiptValue,
} from '@/components/keuangan/ReceiptUpload'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerHero,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { printBukti } from '@/components/keuangan/print-bukti'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { readAppSettings } from '@/features/settings/app-settings'
import {
  CASH_CATEGORIES,
  buildKasStats,
  formatIdr,
  parseIdrInput,
  type CashDirection,
  type CashEntry,
} from '@/features/keuangan/keuangan-data'
import { usePageSize } from '@/features/settings/usePageSize'

const FILTERS = [
  { value: 'all', label: 'Semua mutasi' },
  { value: 'in', label: 'Kas masuk' },
  { value: 'out', label: 'Kas keluar' },
] as const

type Filter = (typeof FILTERS)[number]['value']
type KasSortKey =
  | 'reference'
  | 'description'
  | 'date'
  | 'direction'
  | 'amount'
  | 'balance'
  | 'actor'

type FormState = {
  direction: CashDirection
  category: string
  amount: string
  description: string
  note: string
}

const EMPTY_FORM: FormState = {
  direction: 'in',
  category: 'Penjualan',
  amount: '',
  description: '',
  note: '',
}

export function KasPage() {
  const PAGE_SIZE = usePageSize()
  const { cashEntries, addCashEntry, removeCashEntry } = useFinanceStore()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<SortState<KasSortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const [detail, setDetail] = useState<CashEntry | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [receipt, setReceipt] = useState<ReceiptValue>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  )
  const [confirmDelete, setConfirmDelete] = useState<CashEntry | null>(null)

  const stats = useMemo(() => buildKasStats(cashEntries), [cashEntries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = cashEntries.filter((row) => {
      if (filter !== 'all' && row.direction !== filter) return false
      if (dateFrom && row.date < dateFrom) return false
      if (dateTo && row.date > dateTo) return false
      if (!q) return true
      return (
        row.reference.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        row.actor.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      reference: (r) => r.reference,
      description: (r) => r.description,
      date: (r) => r.date,
      direction: (r) => r.direction,
      amount: (r) => r.amount,
      balance: (r) => r.balance,
      actor: (r) => r.actor,
    })
  }, [cashEntries, search, filter, dateFrom, dateTo, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: KasSortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function notify(message: string) {
    setToast(message)
  }

  function openForm() {
    setForm(EMPTY_FORM)
    setReceipt(null)
    setErrors({})
    setFormOpen(true)
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {}
    const amount = parseIdrInput(form.amount)
    if (!form.description.trim()) next.description = 'Keterangan wajib diisi'
    if (amount <= 0) next.amount = 'Jumlah harus lebih dari 0'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submitForm() {
    if (!validate()) return
    const amount = parseIdrInput(form.amount)
    const err = addCashEntry({
      direction: form.direction,
      category: form.category,
      description: form.note.trim()
        ? `${form.description.trim()} — ${form.note.trim()}`
        : form.description.trim(),
      amount,
      receiptName: receiptPersistRef(receipt),
    })
    if (err) {
      notify(err)
      return
    }
    setFormOpen(false)
    setReceipt(null)
    setPage(1)
    notify('Mutasi kas dicatat')
  }

  function requestDelete(entry: CashEntry) {
    if (readAppSettings().prefs.confirmDelete) {
      setConfirmDelete(entry)
      return
    }
    removeEntry(entry)
  }

  function removeEntry(entry: CashEntry) {
    const err = removeCashEntry(entry.id)
    if (err) {
      notify(err)
      setConfirmDelete(null)
      return
    }
    setConfirmDelete(null)
    if (detail?.id === entry.id) setDetail(null)
    notify(`${entry.reference} dihapus`)
  }

  function handlePrint(entry: CashEntry) {
    const ok = printBukti(
      `Bukti ${entry.reference}`,
      [
        {
          label: entry.direction === 'in' ? 'Kas masuk' : 'Kas keluar',
          value: `${entry.direction === 'in' ? '+' : '−'}${formatIdr(entry.amount)}`,
        },
        { label: 'Tanggal', value: entry.date },
        { label: 'Kategori', value: entry.category },
        { label: 'Keterangan', value: entry.description },
        { label: 'Saldo setelah', value: formatIdr(entry.balance) },
        { label: 'Dicatat oleh', value: entry.actor },
        { label: 'Struk', value: entry.receiptName ?? '—' },
      ],
      { subtitle: entry.description, module: 'Keuangan · Kas' },
    )
    if (!ok) notify('Izinkan popup untuk mencetak')
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Buku kas</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Mutasi kas masuk dan keluar — pencarian, detail, dan pencatatan
            </p>
          </div>
          <FinanceToast message={toast} />
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari referensi, keterangan, kategori…"
          filter={filter}
          filterOptions={FILTERS}
          onFilterChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
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
          actionLabel="+ Catat mutasi"
          onAction={openForm}
        />

        <FinanceTable minWidth="780px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Referensi"
              sortKey="reference"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Keterangan"
              sortKey="description"
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
              label="Arah"
              sortKey="direction"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Jumlah"
              sortKey="amount"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Saldo"
              sortKey="balance"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Oleh"
              sortKey="actor"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={9}
                message="Tidak ada mutasi yang cocok."
              />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {row.reference}
                    <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                      {row.category}
                    </span>
                  </FinanceTd>
                  <FinanceTd className="max-w-[200px] truncate">
                    {row.description}
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {row.date}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={row.direction === 'in' ? 'Masuk' : 'Keluar'}
                      tone={row.direction === 'in' ? 'good' : 'warn'}
                    />
                  </FinanceTd>
                  <FinanceTd
                    mono
                    className={[
                      'font-medium whitespace-nowrap',
                      row.direction === 'in'
                        ? 'text-brand-800'
                        : 'text-amber-800',
                    ].join(' ')}
                  >
                    {row.direction === 'in' ? '+' : '−'}
                    {formatIdr(row.amount)}
                  </FinanceTd>
                  <FinanceTd mono className="whitespace-nowrap">
                    {formatIdr(row.balance)}
                  </FinanceTd>
                  <FinanceTd>
                    <ActorCell name={row.actor} />
                  </FinanceTd>
                  <FinanceTd align="center">
                    <div className="inline-flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setDetail(row)}
                        className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                        aria-label={`Detail ${row.reference}`}
                        title="Detail"
                      >
                        <EyeIcon className="size-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(row)}
                        className="rounded-xl p-2 text-muted transition hover:bg-red-50 hover:text-red-700"
                        aria-label={`Hapus ${row.reference}`}
                        title="Hapus"
                      >
                        <TrashIcon />
                      </button>
                    </div>
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
        <KasDetailDrawer
          entry={detail}
          onClose={() => setDetail(null)}
          onPrint={() => handlePrint(detail)}
          onDelete={() => {
            requestDelete(detail)
            setDetail(null)
          }}
        />
      ) : null}

      {formOpen ? (
        <FinanceModal
          title="Catat mutasi kas"
          subtitle="Kas masuk / keluar"
          onClose={() => {
            setFormOpen(false)
            setReceipt(null)
          }}
          wide
          footer={
            <ModalActions
              onCancel={() => {
                setFormOpen(false)
                setReceipt(null)
              }}
              onConfirm={submitForm}
              confirmLabel="Simpan mutasi"
            />
          }
        >
          <div className="space-y-3">
            <Select
              label="Arah mutasi"
              value={form.direction}
              options={[
                { value: 'in', label: 'Kas masuk', description: 'Uang masuk ke kas' },
                { value: 'out', label: 'Kas keluar', description: 'Uang keluar dari kas' },
              ]}
              onChange={(direction) => setForm((f) => ({ ...f, direction }))}
              requiredMark
            />
            <Select
              label="Kategori"
              value={form.category}
              options={[...CASH_CATEGORIES]}
              onChange={(category) => setForm((f) => ({ ...f, category }))}
              requiredMark
            />
            <TextField
              id="kas-amount"
              label="Jumlah (Rp)"
              requiredMark
              inputMode="numeric"
              placeholder="Contoh: 2500000"
              value={form.amount}
              error={errors.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
            {parseIdrInput(form.amount) > 0 ? (
              <p className="font-mono text-[11px] text-muted">
                = {formatIdr(parseIdrInput(form.amount))}
              </p>
            ) : null}
            <TextField
              id="kas-desc"
              label="Keterangan"
              requiredMark
              placeholder="Ringkas tujuan mutasi"
              value={form.description}
              error={errors.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <TextAreaField
              id="kas-note"
              label="Catatan (opsional)"
              value={form.note}
              onChange={(note) => setForm((f) => ({ ...f, note }))}
              placeholder="Referensi dokumen, nomor invoice, dll."
              rows={2}
            />
            <ReceiptUpload value={receipt} onChange={setReceipt} />
          </div>
        </FinanceModal>
      ) : null}

      {confirmDelete ? (
        <FinanceModal
          title={`Hapus ${confirmDelete.reference}?`}
          subtitle="Konfirmasi"
          onClose={() => setConfirmDelete(null)}
          footer={
            <ModalActions
              onCancel={() => setConfirmDelete(null)}
              onConfirm={() => removeEntry(confirmDelete)}
              confirmLabel="Ya, hapus"
              danger
            />
          }
        >
          <p className="text-[13px] text-muted">
            Mutasi <span className="font-medium text-ink">{confirmDelete.description}</span>{' '}
            sebesar {formatIdr(confirmDelete.amount)} akan dihapus dari buku kas
            (MVP lokal).
          </p>
        </FinanceModal>
      ) : null}
    </div>
  )
}

function KasDetailDrawer({
  entry,
  onClose,
  onPrint,
  onDelete,
}: {
  entry: CashEntry
  onClose: () => void
  onPrint: () => void
  onDelete: () => void
}) {
  const isIn = entry.direction === 'in'

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={entry.reference}
      subtitle={entry.date}
      badge={
        <StatusPill
          label={isIn ? 'Masuk' : 'Keluar'}
          tone={isIn ? 'good' : 'warn'}
        />
      }
      footer={
        <>
          <button
            type="button"
            onClick={onPrint}
            className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
          >
            Cetak bukti
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
          >
            Hapus mutasi
          </button>
        </>
      }
    >
      <DrawerHero
        label={isIn ? 'Kas masuk' : 'Kas keluar'}
        amount={`${isIn ? '+' : '−'}${formatIdr(entry.amount)}`}
        tone={isIn ? 'good' : 'warn'}
        hint={`Saldo setelah: ${formatIdr(entry.balance)}`}
      />

      <div className="mb-4 rounded-2xl border border-line/80 bg-surface/80 px-3.5 py-3">
        <p className="text-[12px] text-muted">Keterangan</p>
        <p className="mt-1 text-[14px] leading-snug font-medium text-ink">
          {entry.description}
        </p>
        <p className="mt-1.5 text-[12px] text-muted">Dicatat oleh {entry.actor}</p>
      </div>

      <DrawerSection label="Rincian">
        <DrawerFacts
          items={[
            ['Referensi', entry.reference],
            ['Tanggal', entry.date],
            ['Kategori', entry.category],
            ['Arah', isIn ? 'Masuk' : 'Keluar'],
            ['Jumlah', formatIdr(entry.amount)],
            ['Saldo setelah', formatIdr(entry.balance)],
          ]}
        />
      </DrawerSection>

      <DrawerSection label="Bukti">
        {entry.receiptName ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2.5">
            <p className="text-[11px] text-muted">Lampiran struk</p>
            <p className="num mt-1 truncate text-[13px] font-medium text-brand-900">
              {entry.receiptName}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[13px] text-muted">
            Tidak ada lampiran struk.
          </p>
        )}
      </DrawerSection>
    </DetailDrawer>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
