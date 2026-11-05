import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { FinancePager } from '@/components/keuangan/FinancePager'
import {
  ActorCell,
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
import { StatusPill } from '@/components/keuangan/StatusPill'
import { PageSection } from '@/components/ui/PageSection'
import { useAuth } from '@/features/auth/AuthContext'
import { useMasterStore } from '@/features/master/master-store'
import { usePageSize } from '@/features/settings/usePageSize'
import { ROLE_LABELS, type UserRole } from '@/types/auth'

type RoleFilter = 'all' | UserRole
type KaryawanSortKey = 'name' | 'email' | 'role' | 'status'

export function HrKaryawanPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const { users } = useMasterStore()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [sort, setSort] = useState<SortState<KaryawanSortKey> | null>({
    key: 'name',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = users
      .filter((u) => roleFilter === 'all' || u.role === roleFilter)
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    return sortBy(base, sort, {
      name: (u) => u.name,
      email: (u) => u.email,
      role: (u) => u.role,
      status: (u) => (u.active ? 1 : 0),
    })
  }, [users, search, roleFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  if (!user) return null
  if (user.role !== 'admin' && user.role !== 'hr') {
    return <Navigate to="/absensi" replace />
  }

  return (
    <div className="space-y-2.5">
      <PageSection
        title="Roster karyawan"
        subtitle="Read-only dari master pengguna"
      >
        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari nama atau email…"
          filter={roleFilter}
          filterLabel="Peran"
          filterOptions={[
            { value: 'all', label: 'Semua peran' },
            { value: 'admin', label: 'Admin' },
            { value: 'hr', label: 'HR' },
            { value: 'keuangan', label: 'Keuangan' },
            { value: 'pembelian', label: 'Pembelian' },
            { value: 'produksi', label: 'Produksi' },
            { value: 'gudang', label: 'Gudang' },
            { value: 'penjualan', label: 'Penjualan' },
          ]}
          onFilterChange={(v) => {
            setRoleFilter(v)
            setPage(1)
          }}
        />

        <FinanceTable minWidth="720px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Nama"
              sortKey="name"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Email"
              sortKey="email"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Peran"
              sortKey="role"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={5} message="Tidak ada karyawan." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd>
                    <ActorCell name={row.name} />
                  </FinanceTd>
                  <FinanceTd muted>{row.email}</FinanceTd>
                  <FinanceTd>{ROLE_LABELS[row.role] ?? row.role}</FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={row.active ? 'Aktif' : 'Nonaktif'}
                      tone={row.active ? 'good' : 'muted'}
                    />
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
      </PageSection>
    </div>
  )
}
