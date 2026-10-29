import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  DetailFields,
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
  type ReceiptValue,
} from '@/components/keuangan/ReceiptUpload'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { printBukti } from '@/components/keuangan/print-bukti'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS_LABEL,
  buildBiayaStats,
  formatIdr,
  parseIdrInput,
  type ExpenseRow,
  type ExpenseStatus,
} from '@/features/keuangan/keuangan-data'

const PAGE_SIZE = 6

const FILTERS = [
  { value: 'all', label: 'Semua kategori' },
  { value: 'Tenaga', label: 'Tenaga' },
  { value: 'Utilitas', label: 'Utilitas' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Pemeliharaan', label: 'Pemeliharaan' },
  { value: 'Lainnya', label: 'Lainnya' },
] as const

type Filter = (typeof FILTERS)[number]['value']
type BiayaSortKey =
  | 'reference'
  | 'category'
  | 'date'
  | 'status'
  | 'description'
  | 'amount'
  | 'actor'

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'void', label: 'Void' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

const STATUS_TONE: Record<ExpenseStatus, 'neutral' | 'good' | 'warn' | 'muted'> =
  {
    draft: 'warn',
    posted: 'good',
    void: 'muted',
  }

type FormState = {
  category: string
  amount: string
  description: string
  note: string
  status: 'draft' | 'posted'
}

const EMPTY_FORM: FormState = {
  category: 'Tenaga',
  amount: '',
  description: '',
  note: '',
  status: 'draft',
}

export function BiayaPage() {
  const { expenses, addExpense, setExpenseStatus } = useFinanceStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortState<BiayaSortKey> | null>({
    key: 'date',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const [detail, setDetail] = useState<ExpenseRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [receipt, setReceipt] = useState<ReceiptValue>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  )

  const stats = useMemo(() => buildBiayaStats(expenses), [expenses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = expenses.filter((row) => {
      if (filter !== 'all' && row.category !== filter) return false
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
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
      category: (r) => r.category,
      date: (r) => r.date,
      status: (r) => r.status,
      description: (r) => r.description,
      amount: (r) => r.amount,
      actor: (r) => r.actor,
    })
  }, [expenses, search, filter, statusFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: BiayaSortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function openForm() {
    setForm(EMPTY_FORM)
    setReceipt(null)
    setErrors({})
    setFormOpen(true)
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.description.trim()) next.description = 'Keterangan wajib diisi'
    if (parseIdrInput(form.amount) <= 0) next.amount = 'Jumlah harus lebih dari 0'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submitForm() {
    if (!validate()) return
    addExpense({
      category: form.category,
      description: form.note.trim()
        ? `${form.description.trim()} — ${form.note.trim()}`
        : form.description.trim(),
      amount: parseIdrInput(form.amount),
      status: form.status,
      receiptName: receipt?.name,
    })
    setFormOpen(false)
    setReceipt(null)
    setPage(1)
    setToast(
      `Biaya dicatat (${EXPENSE_STATUS_LABEL[form.status]})${
        form.status === 'posted' ? ' · sinkron ke Kas' : ''
      }`,
    )
  }

  function setStatus(row: ExpenseRow, status: ExpenseStatus) {
    setExpenseStatus(row.id, status)
    setDetail((d) => (d?.id === row.id ? { ...d, status } : d))
    setToast(
      `${row.reference} → ${EXPENSE_STATUS_LABEL[status]}${
        status === 'posted' && row.status !== 'posted' ? ' · sinkron ke Kas' : ''
      }`,
    )
  }

  function handlePrint(row: ExpenseRow) {
    const ok = printBukti(`Bukti biaya ${row.reference}`, [
      { label: 'Tanggal', value: row.date },
      { label: 'Kategori', value: row.category },
      { label: 'Keterangan', value: row.description },
      { label: 'Jumlah', value: formatIdr(row.amount) },
      { label: 'Status', value: EXPENSE_STATUS_LABEL[row.status] },
      { label: 'Dicatat oleh', value: row.actor },
      { label: 'Struk', value: row.receiptName ?? '—' },
    ])
    if (!ok) setToast('Izinkan popup untuk mencetak')
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Biaya operasional
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Catat, cari, posting, atau void biaya operasional
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
          filterLabel="Filter kategori"
          secondaryFilter={statusFilter}
          secondaryFilterOptions={STATUS_FILTERS}
          onSecondaryFilterChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          secondaryFilterLabel="Filter status"
          actionLabel="+ Catat biaya"
          onAction={openForm}
        />

        <FinanceTable minWidth="760px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Referensi"
              sortKey="reference"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Kategori"
              sortKey="category"
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
              label="Status"
              sortKey="status"
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
              label="Jumlah"
              sortKey="amount"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Oleh"
              sortKey="actor"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="right" className="w-28">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={9}
                message="Tidak ada biaya yang cocok."
              />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {row.reference}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill label={row.category} tone="neutral" />
                  </FinanceTd>
                  <FinanceTd mono muted>
                    {row.date}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={EXPENSE_STATUS_LABEL[row.status]}
                      tone={STATUS_TONE[row.status]}
                    />
                  </FinanceTd>
                  <FinanceTd className="max-w-[220px] truncate">
                    {row.description}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium whitespace-nowrap">
                    {formatIdr(row.amount)}
                  </FinanceTd>
                  <FinanceTd>
                    <ActorCell name={row.actor} />
                  </FinanceTd>
                  <FinanceTd align="right">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                      aria-label={`Detail ${row.reference}`}
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
        <FinanceModal
          title={detail.reference}
          subtitle="Detail biaya operasional"
          onClose={() => setDetail(null)}
          footer={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePrint(detail)}
                className="h-11 min-w-[7.5rem] flex-1 rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Cetak
              </button>
              {detail.status === 'draft' ? (
                <button
                  type="button"
                  onClick={() => setStatus(detail, 'posted')}
                  className="h-11 min-w-[7.5rem] flex-1 rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
                >
                  Posting
                </button>
              ) : null}
              {detail.status !== 'void' ? (
                <button
                  type="button"
                  onClick={() => setStatus(detail, 'void')}
                  className="h-11 min-w-[7.5rem] flex-1 rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
                >
                  Void
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStatus(detail, 'draft')}
                  className="h-11 min-w-[7.5rem] flex-1 rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
                >
                  Kembalikan draft
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="h-11 min-w-[7.5rem] flex-1 rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Tutup
              </button>
            </div>
          }
        >
          <DetailFields
            fields={[
              { label: 'Tanggal', value: detail.date },
              { label: 'Kategori', value: detail.category },
              { label: 'Keterangan', value: detail.description },
              { label: 'Jumlah', value: formatIdr(detail.amount) },
              { label: 'Status', value: EXPENSE_STATUS_LABEL[detail.status] },
              { label: 'Dicatat oleh', value: detail.actor },
              {
                label: 'Struk',
                value: detail.receiptName ?? 'Tidak ada lampiran',
              },
            ]}
          />
        </FinanceModal>
      ) : null}

      {formOpen ? (
        <FinanceModal
          title="Catat biaya operasional"
          subtitle="Dokumen biaya baru"
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
              confirmLabel="Simpan biaya"
            />
          }
        >
          <div className="space-y-3">
            <Select
              label="Kategori"
              value={form.category}
              options={[...EXPENSE_CATEGORIES]}
              onChange={(category) => setForm((f) => ({ ...f, category }))}
              requiredMark
            />
            <Select
              label="Status awal"
              value={form.status}
              options={[
                { value: 'draft', label: 'Draft', description: 'Belum dibukukan' },
                { value: 'posted', label: 'Posted', description: 'Langsung dibukukan' },
              ]}
              onChange={(status) => setForm((f) => ({ ...f, status }))}
              requiredMark
            />
            <TextField
              id="biaya-amount"
              label="Jumlah (Rp)"
              requiredMark
              inputMode="numeric"
              placeholder="Contoh: 1850000"
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
              id="biaya-desc"
              label="Keterangan"
              requiredMark
              placeholder="Uraian singkat biaya"
              value={form.description}
              error={errors.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <TextAreaField
              id="biaya-note"
              label="Catatan (opsional)"
              value={form.note}
              onChange={(note) => setForm((f) => ({ ...f, note }))}
              placeholder="No. bukti, vendor, dll."
              rows={2}
            />
            <ReceiptUpload
              value={receipt}
              onChange={setReceipt}
              label="Upload struk / bukti biaya"
            />
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}
