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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import {
  type Account,
  type AccountType,
  type JournalEntry,
} from '@/features/keuangan/gl-data'
import { usePageSize } from '@/features/settings/usePageSize'

const TYPE_FILTERS = [
  { value: 'all', label: 'Semua tipe' },
  { value: 'asset', label: 'Aset' },
  { value: 'liability', label: 'Liabilitas' },
  { value: 'equity', label: 'Ekuitas' },
  { value: 'revenue', label: 'Pendapatan' },
  { value: 'expense', label: 'Beban' },
] as const

type TypeFilter = (typeof TYPE_FILTERS)[number]['value']

const ACTIVE_FILTERS = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
] as const

type ActiveFilter = (typeof ACTIVE_FILTERS)[number]['value']

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Aset',
  liability: 'Liabilitas',
  equity: 'Ekuitas',
  revenue: 'Pendapatan',
  expense: 'Beban',
}

const ACCOUNT_TYPE_OPTIONS = (
  Object.entries(ACCOUNT_TYPE_LABEL) as [AccountType, string][]
).map(([value, label]) => ({ value, label }))

type CoaSortKey = 'code' | 'name' | 'type' | 'active'

type FormState = {
  code: string
  name: string
  type: AccountType
  isPostable: boolean
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  type: 'expense',
  isPostable: true,
}

function newAccountId(): string {
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function accountUsedInJournals(
  accountId: string,
  journals: JournalEntry[],
): boolean {
  return journals.some(
    (j) =>
      !j.voidedAt && j.lines.some((line) => line.accountId === accountId),
  )
}

export function CoaPage() {
  const PAGE_SIZE = usePageSize()
  const { accounts, journals, upsertAccount, setAccountActive } =
    useFinanceStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [sort, setSort] = useState<SortState<CoaSortKey> | null>({
    key: 'code',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Account | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = accounts.filter((row) => {
      if (typeFilter !== 'all' && row.type !== typeFilter) return false
      if (activeFilter === 'active' && !row.active) return false
      if (activeFilter === 'inactive' && row.active) return false
      if (!q) return true
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        ACCOUNT_TYPE_LABEL[row.type].toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      code: (r) => r.code,
      name: (r) => r.name,
      type: (r) => r.type,
      active: (r) => (r.active ? 1 : 0),
    })
  }, [accounts, search, typeFilter, activeFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function handleSort(key: CoaSortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(row: Account) {
    setEditing(row)
    setForm({
      code: row.code,
      name: row.name,
      type: row.type,
      isPostable: row.isPostable,
    })
    setFormError(null)
    setFormOpen(true)
  }

  const codeLocked =
    editing != null && accountUsedInJournals(editing.id, journals)

  function submitForm() {
    const payload: Account = editing
      ? {
          ...editing,
          code: codeLocked ? editing.code : form.code.trim(),
          name: form.name.trim(),
          type: editing.system ? editing.type : form.type,
          isPostable: editing.system ? editing.isPostable : form.isPostable,
          active: editing.active,
        }
      : {
          id: newAccountId(),
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          isPostable: form.isPostable,
          active: true,
          system: false,
        }

    const err = upsertAccount(payload)
    if (err) {
      setFormError(err)
      return
    }
    setFormOpen(false)
    setEditing(null)
    setPage(1)
    setToast(editing ? `Akun ${payload.code} diperbarui` : `Akun ${payload.code} ditambahkan`)
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return
    const err = setAccountActive(deactivateTarget.id, false)
    if (err) {
      setToast(err)
    } else {
      setToast(`${deactivateTarget.code} dinonaktifkan`)
    }
    setDeactivateTarget(null)
  }

  function activate(row: Account) {
    const err = setAccountActive(row.id, true)
    setToast(err ?? `${row.code} diaktifkan kembali`)
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Bagan akun</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Kelola kode akun GL; akun sistem hanya bisa dinonaktifkan
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
          searchPlaceholder="Cari kode atau nama akun…"
          filter={typeFilter}
          filterOptions={TYPE_FILTERS}
          onFilterChange={(v) => {
            setTypeFilter(v)
            setPage(1)
          }}
          filterLabel="Filter tipe"
          secondaryFilter={activeFilter}
          secondaryFilterOptions={ACTIVE_FILTERS}
          onSecondaryFilterChange={(v) => {
            setActiveFilter(v)
            setPage(1)
          }}
          secondaryFilterLabel="Filter status"
          actionLabel="+ Tambah akun"
          onAction={openAdd}
        />

        <FinanceTable minWidth="720px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Kode"
              sortKey="code"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Nama"
              sortKey="name"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Tipe"
              sortKey="type"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Status"
              sortKey="active"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center" className="w-36">
              Aksi
            </FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={6} message="Tidak ada akun yang cocok." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="font-medium">
                    {row.code}
                  </FinanceTd>
                  <FinanceTd className="max-w-[240px] truncate">{row.name}</FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={ACCOUNT_TYPE_LABEL[row.type]}
                      tone="neutral"
                    />
                  </FinanceTd>
                  <FinanceTd>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill
                        label={row.active ? 'Aktif' : 'Nonaktif'}
                        tone={row.active ? 'good' : 'muted'}
                      />
                      {row.system ? (
                        <StatusPill label="Sistem" tone="warn" />
                      ) : null}
                    </div>
                  </FinanceTd>
                  <FinanceTd align="center">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-brand-800 transition hover:bg-brand-50"
                      >
                        Edit
                      </button>
                      {row.active ? (
                        <button
                          type="button"
                          onClick={() => setDeactivateTarget(row)}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Nonaktifkan
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => activate(row)}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:bg-surface"
                        >
                          Aktifkan
                        </button>
                      )}
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

      {formOpen ? (
        <FinanceModal
          title={editing ? 'Edit akun' : 'Tambah akun'}
          subtitle={editing ? editing.code : 'Akun non-sistem'}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          footer={
            <ModalActions
              onCancel={() => {
                setFormOpen(false)
                setEditing(null)
              }}
              onConfirm={submitForm}
              confirmLabel={editing ? 'Simpan perubahan' : 'Tambah akun'}
            />
          }
        >
          <div className="space-y-3">
            {formError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                {formError}
              </p>
            ) : null}
            <TextField
              id="coa-code"
              label="Kode akun"
              requiredMark
              placeholder="Contoh: 5-2400"
              value={form.code}
              disabled={codeLocked}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            {codeLocked ? (
              <p className="text-[11px] text-muted">
                Kode tidak bisa diubah karena akun sudah dipakai di jurnal.
              </p>
            ) : null}
            <TextField
              id="coa-name"
              label="Nama akun"
              requiredMark
              placeholder="Nama tampilan"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {!editing?.system ? (
              <>
                <Select
                  label="Tipe akun"
                  value={form.type}
                  options={ACCOUNT_TYPE_OPTIONS}
                  onChange={(type) =>
                    setForm((f) => ({ ...f, type: type as AccountType }))
                  }
                  requiredMark
                />
                <Select
                  label="Bisa diposting"
                  value={form.isPostable ? 'yes' : 'no'}
                  options={[
                    { value: 'yes', label: 'Ya', description: 'Bisa dipakai di jurnal' },
                    {
                      value: 'no',
                      label: 'Tidak',
                      description: 'Header / grouping saja',
                    },
                  ]}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, isPostable: v === 'yes' }))
                  }
                  requiredMark
                />
              </>
            ) : (
              <p className="text-[12px] text-muted">
                Akun sistem: tipe dan flag posting tetap dari seed.
              </p>
            )}
          </div>
        </FinanceModal>
      ) : null}

      {deactivateTarget ? (
        <ConfirmDialog
          open
          title="Nonaktifkan akun?"
          description={`Akun ${deactivateTarget.code} · ${deactivateTarget.name} tidak akan bisa dipakai di jurnal baru. Entri lama tetap tersimpan.`}
          confirmLabel="Nonaktifkan"
          danger
          onConfirm={confirmDeactivate}
          onClose={() => setDeactivateTarget(null)}
        />
      ) : null}
    </div>
  )
}
