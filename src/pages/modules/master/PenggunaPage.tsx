import { useEffect, useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import {
  FinanceModal,
  ModalActions,
} from '@/components/keuangan/FinanceModal'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
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
import { AlertCard } from '@/components/ui/AlertCard'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { printBukti } from '@/components/keuangan/print-bukti'
import {
  DetailDrawer,
  DrawerFacts,
  DrawerSection,
} from '@/components/ops/DetailDrawer'
import { EyeIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import {
  buildPenggunaStats,
  type MasterUser,
} from '@/features/master/master-data'
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
  validateUserForm,
  type UserFieldErrors,
} from '@/features/master/input-safety'
import { useMasterStore } from '@/features/master/master-store'
import { usePageSize } from '@/features/settings/usePageSize'
import { ROLE_LABELS, type UserRole } from '@/types/auth'

type SortKey = 'name' | 'email' | 'role' | 'branch' | 'phone' | 'active'
type RoleFilter = 'all' | UserRole
type StatusFilter = 'all' | 'active' | 'inactive'

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))

const ADD_OPTION = '__add__'

function uniqueLabels(current: string, ...groups: string[][]): string[] {
  const values = new Set<string>()
  for (const group of groups) {
    for (const item of group) {
      const text = item.trim()
      if (text) values.add(text)
    }
  }
  if (current.trim() && current !== ADD_OPTION) values.add(current.trim())
  return [...values].sort((a, b) => a.localeCompare(b, 'id'))
}

type FormState = {
  name: string
  email: string
  role: UserRole
  title: string
  phone: string
  branch: string
  department: string
  active: boolean
  password: string
}

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  role: 'pembelian',
  title: ROLE_LABELS.pembelian,
  phone: '',
  branch: 'Mill Klaten',
  department: ROLE_LABELS.pembelian,
  active: true,
  password: '',
})

export function PenggunaPage() {
  const {
    users,
    persistError,
    upsertUser,
    createBranchAccount,
    setUserActive,
    removeUser,
  } = useMasterStore()
  const PAGE_SIZE = usePageSize()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortState<SortKey> | null>({
    key: 'name',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<MasterUser | null>(null)
  const [editing, setEditing] = useState<MasterUser | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<UserFieldErrors>({})
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const stats = useMemo(() => buildPenggunaStats(users), [users])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => setPage(1), [search, role, status])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = users.filter((u) => {
      if (role !== 'all' && u.role !== role) return false
      if (status === 'active' && !u.active) return false
      if (status === 'inactive' && u.active) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        u.branch.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      )
    })
    return sortBy(base, sort, {
      name: (r) => r.name,
      email: (r) => r.email,
      role: (r) => r.role,
      branch: (r) => r.branch,
      phone: (r) => r.phone,
      active: (r) => (r.active ? 1 : 0),
    })
  }, [users, search, role, status, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSort(prev, key))
    setPage(1)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
    setFormOpen(true)
  }

  function openEdit(row: MasterUser) {
    setEditing(row)
    setForm({
      name: row.name,
      email: row.email,
      role: row.role,
      title: row.title,
      phone: row.phone,
      branch: row.branch,
      department: row.department,
      active: row.active,
      password: '',
    })
    setFormErrors({})
    setFormOpen(true)
    setDetail(null)
  }

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setFormErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function saveForm() {
    const nextErrors = validateUserForm(form)
    if (!editing && form.password.trim().length < 8) {
      nextErrors.password = 'Minimal 8 karakter'
    }
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setToast('Periksa kembali isian yang belum valid')
      return
    }
    const email = sanitizeEmail(form.email).trim().toLowerCase()
    const dup = users.find(
      (u) => u.email.toLowerCase() === email && u.id !== editing?.id,
    )
    if (dup) {
      setToast('Email sudah terpakai')
      return
    }
    const payload = {
      name: sanitizeText(form.name, 80).trim(),
      email,
      role: form.role,
      title: sanitizeText(form.title, 80).trim() || ROLE_LABELS[form.role],
      phone: sanitizePhone(form.phone).trim(),
      branch: sanitizeText(form.branch, 80).trim() || 'Mill Klaten',
      department:
        sanitizeText(form.department, 80).trim() || ROLE_LABELS[form.role],
      active: form.active,
    }
    if (!editing) {
      setSaving(true)
      const err = await createBranchAccount({
        ...payload,
        password: form.password,
      })
      setSaving(false)
      if (err) {
        setToast(err)
        return
      }
      setFormOpen(false)
      setFormErrors({})
      setToast('Akun cabang dibuat. Mereka bisa masuk dengan email dan kata sandi ini.')
      return
    }
    upsertUser(payload, editing.id)
    setFormOpen(false)
    setFormErrors({})
    setToast('Pengguna diperbarui')
  }

  function handlePrint(row: MasterUser) {
    printBukti(
      row.name,
      [
        { label: 'ID', value: row.id },
        { label: 'Email', value: row.email },
        { label: 'Peran', value: ROLE_LABELS[row.role] },
        { label: 'Jabatan', value: row.title },
        { label: 'Departemen', value: row.department },
        { label: 'Cabang', value: row.branch },
        { label: 'Telepon', value: row.phone || ',' },
        { label: 'Status', value: row.active ? 'Aktif' : 'Nonaktif' },
      ],
      { subtitle: 'Kartu pengguna', module: 'Master Data · Pengguna' },
    )
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />
      <FinanceToast message={toast} />
      {persistError ? <AlertCard tone="danger">{persistError}</AlertCard> : null}

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Pengguna & peran
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Admin membuat akun login beserta cabang. Peran dan lokasi tersimpan di database.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="h-10 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900"
          >
            + Pengguna
          </button>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nama, email, cabang…"
          filter={role}
          filterLabel="Peran"
          filterOptions={[
            { value: 'all', label: 'Semua peran' },
            ...ROLE_OPTIONS,
          ]}
          onFilterChange={setRole}
          secondaryFilter={status}
          secondaryFilterLabel="Status"
          secondaryFilterOptions={[
            { value: 'all', label: 'Semua status' },
            { value: 'active', label: 'Aktif' },
            { value: 'inactive', label: 'Nonaktif' },
          ]}
          onSecondaryFilterChange={setStatus}
        />

        <FinanceTable>
          <FinanceThead>
            <FinanceTh className="w-10">#</FinanceTh>
            <FinanceSortTh
              label="Nama"
              sortKey="name"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Email"
              sortKey="email"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Peran"
              sortKey="role"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Cabang"
              sortKey="branch"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Telepon"
              sortKey="phone"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceSortTh
              label="Status"
              sortKey="active"
              sort={sort}
              onSort={handleSort}
            />
            <FinanceTh align="center">Aksi</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={8} message="Tidak ada data." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{row.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        {row.department}
                      </p>
                    </div>
                  </FinanceTd>
                  <FinanceTd mono className="text-[12px]">
                    {row.email}
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill label={ROLE_LABELS[row.role]} tone="neutral" />
                  </FinanceTd>
                  <FinanceTd>{row.branch}</FinanceTd>
                  <FinanceTd mono>{row.phone || ','}</FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={row.active ? 'Aktif' : 'Nonaktif'}
                      tone={row.active ? 'good' : 'muted'}
                    />
                  </FinanceTd>
                  <FinanceTd align="center">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="rounded-xl p-2 text-muted transition hover:bg-brand-50 hover:text-brand-800"
                      aria-label={`Detail ${row.name}`}
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
          title={detail.name}
          subtitle={detail.email}
          badge={
            <StatusPill
              label={detail.active ? 'Aktif' : 'Nonaktif'}
              tone={detail.active ? 'good' : 'muted'}
            />
          }
          footer={
            <>
              <button
                type="button"
                onClick={() => handlePrint(detail)}
                className="h-11 w-full rounded-xl bg-brand-800 text-[14px] font-semibold text-white transition hover:bg-brand-900"
              >
                Cetak kartu
              </button>
              <button
                type="button"
                onClick={() => openEdit(detail)}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserActive(detail.id, !detail.active)
                  setDetail({ ...detail, active: !detail.active })
                  setToast(
                    detail.active ? 'Pengguna nonaktif' : 'Pengguna diaktifkan',
                  )
                }}
                className="h-11 w-full rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
              >
                {detail.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              {detail.role !== 'admin' ? (
                <button
                  type="button"
                  onClick={() => {
                    removeUser(detail.id)
                    setDetail(null)
                    setToast('Pengguna dihapus')
                  }}
                  className="h-11 w-full rounded-xl border border-red-200 text-[14px] font-medium text-red-700 transition hover:bg-red-50"
                >
                  Hapus
                </button>
              ) : null}
            </>
          }
        >
          <DrawerSection label="Akun">
            <DrawerFacts
              items={[
                ['ID', detail.id],
                ['Peran', ROLE_LABELS[detail.role]],
                ['Jabatan', detail.title],
                ['Departemen', detail.department],
                ['Cabang', detail.branch],
                ['Telepon', detail.phone || ','],
              ]}
            />
          </DrawerSection>
          <DrawerSection label="Login">
            <p className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5 text-[13px] text-muted">
              Akun bawaan demo memakai kata sandi demo123. Akun yang dibuat admin memakai kata sandi yang diisi saat pendaftaran.
            </p>
          </DrawerSection>
        </DetailDrawer>
      ) : null}

      {formOpen ? (
        <FinanceModal
          title={editing ? 'Edit pengguna' : 'Tambah pengguna'}
          subtitle={editing?.id ?? 'Akun baru'}
          onClose={() => setFormOpen(false)}
          wide
          footer={
            <ModalActions
              onCancel={() => setFormOpen(false)}
              onConfirm={() => void saveForm()}
              confirmLabel="Simpan"
              confirmLoading={saving}
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="usr-name"
              label="Nama"
              requiredMark
              value={form.name}
              placeholder="Nama lengkap"
              maxLength={80}
              error={formErrors.name}
              onChange={(e) =>
                patchForm('name', sanitizeText(e.target.value, 80))
              }
            />
            <TextField
              id="usr-email"
              label="Email"
              type="email"
              requiredMark
              value={form.email}
              placeholder="user@egabah.local"
              maxLength={120}
              error={formErrors.email}
              onChange={(e) =>
                patchForm('email', sanitizeEmail(e.target.value))
              }
            />
            <Select
              label="Peran"
              value={form.role}
              options={ROLE_OPTIONS}
              onChange={(role) =>
                setForm((f) => ({
                  ...f,
                  role,
                  title:
                    f.title === ROLE_LABELS[f.role]
                      ? ROLE_LABELS[role]
                      : f.title,
                  department:
                    f.department === ROLE_LABELS[f.role]
                      ? ROLE_LABELS[role]
                      : f.department,
                }))
              }
            />
            <AddableSelect
              id="usr-title"
              label="Jabatan"
              value={form.title}
              choices={uniqueLabels(
                form.title,
                users.map((u) => u.title),
                Object.values(ROLE_LABELS),
              )}
              error={formErrors.title}
              onChange={(title) => patchForm('title', title)}
            />
            <AddableSelect
              id="usr-dept"
              label="Departemen"
              value={form.department}
              choices={uniqueLabels(
                form.department,
                users.map((u) => u.department),
                Object.values(ROLE_LABELS),
              )}
              error={formErrors.department}
              onChange={(department) => patchForm('department', department)}
            />
            <AddableSelect
              id="usr-branch"
              label="Cabang / lokasi"
              value={form.branch}
              choices={uniqueLabels(
                form.branch,
                users.map((u) => u.branch),
                ['Mill Klaten', 'Kantor Pusat'],
              )}
              error={formErrors.branch}
              onChange={(branch) => patchForm('branch', branch)}
            />
            {editing ? null : (
              <TextField
                id="usr-password"
                label="Kata sandi awal"
                type="password"
                requiredMark
                value={form.password}
                placeholder="Minimal 8 karakter"
                error={formErrors.password}
                onChange={(e) => patchForm('password', e.target.value)}
              />
            )}
            <TextField
              id="usr-phone"
              label="Telepon"
              value={form.phone}
              placeholder="08xx-xxxx-xxxx"
              inputMode="tel"
              maxLength={20}
              error={formErrors.phone}
              onChange={(e) =>
                patchForm('phone', sanitizePhone(e.target.value))
              }
            />
            <div className="flex items-end pb-1">
              <Switch
                id="usr-active"
                label="Aktif"
                checked={form.active}
                onChange={(active) => patchForm('active', active)}
              />
            </div>
          </div>
        </FinanceModal>
      ) : null}
    </div>
  )
}

function AddableSelect({
  id,
  label,
  value,
  choices,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  choices: string[]
  error?: string
  onChange: (value: string) => void
}) {
  const [adding, setAdding] = useState(
    () => value.trim().length > 0 && !choices.includes(value),
  )
  const options = [
    ...choices.map((item) => ({ value: item, label: item })),
    { value: ADD_OPTION, label: 'Tambah baru…' },
  ]
  return (
    <div className="space-y-2">
      <Select
        label={label}
        value={adding ? ADD_OPTION : value}
        options={options}
        onChange={(next) => {
          if (next === ADD_OPTION) {
            setAdding(true)
            onChange('')
            return
          }
          setAdding(false)
          onChange(next)
        }}
      />
      {adding ? (
        <TextField
          id={id}
          label={`Nama ${label.toLowerCase()}`}
          requiredMark
          value={value}
          placeholder="Ketik nama baru"
          maxLength={80}
          error={error}
          onChange={(e) => onChange(sanitizeText(e.target.value, 80))}
        />
      ) : null}
    </div>
  )
}
