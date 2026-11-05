import { useMemo, useState } from 'react'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { FinancePager } from '@/components/keuangan/FinancePager'
import {
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
  rowNumber,
} from '@/components/keuangan/FinanceTable'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { useAuditStore } from '@/features/audit/audit-store'
import { usePageSize } from '@/features/settings/usePageSize'
import { downloadCsv } from '@/features/persediaan/persediaan-utils'

export function AuditPage() {
  const { logs } = useAuditStore()
  const PAGE_SIZE = usePageSize()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((l) => {
      if (filter !== 'all' && l.entity !== filter) return false
      if (!q) return true
      return [l.id, l.actor, l.action, l.entity, l.entityId, l.note ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [logs, search, filter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Audit log</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Jejak aksi domain (append-only lokal)
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                `audit-${new Date().toISOString().slice(0, 10)}.csv`,
                ['ID', 'Waktu', 'Actor', 'Aksi', 'Entitas', 'Entity ID', 'Catatan'],
                filtered.map((l) => [
                  l.id,
                  l.at,
                  l.actor,
                  l.action,
                  l.entity,
                  l.entityId,
                  l.note ?? '',
                ]),
              )
            }
            className="h-10 rounded-xl border border-line px-3.5 text-[13px] font-medium text-ink hover:bg-surface"
          >
            Export CSV
          </button>
        </div>

        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari actor, aksi, ID…"
          filter={filter}
          filterLabel="Entitas"
          filterOptions={[
            { value: 'all', label: 'Semua' },
            { value: 'batch', label: 'Batch' },
            { value: 'purchase', label: 'Pembelian' },
            { value: 'sale', label: 'Penjualan' },
            { value: 'expense', label: 'Biaya/Payroll' },
          ]}
          onFilterChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
        />

        <FinanceTable>
          <FinanceThead>
            <FinanceTh className="w-10">#</FinanceTh>
            <FinanceTh>Waktu</FinanceTh>
            <FinanceTh>Actor</FinanceTh>
            <FinanceTh>Aksi</FinanceTh>
            <FinanceTh>Entitas</FinanceTh>
            <FinanceTh>ID</FinanceTh>
            <FinanceTh>Catatan</FinanceTh>
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow colSpan={7} message="Belum ada log." />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd mono className="text-[11px]">
                    {new Date(row.at).toLocaleString('id-ID')}
                  </FinanceTd>
                  <FinanceTd>{row.actor}</FinanceTd>
                  <FinanceTd>
                    <StatusPill label={row.action} tone="neutral" />
                  </FinanceTd>
                  <FinanceTd>{row.entity}</FinanceTd>
                  <FinanceTd mono>{row.entityId}</FinanceTd>
                  <FinanceTd>{row.note || ','}</FinanceTd>
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
    </div>
  )
}
