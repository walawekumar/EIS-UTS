import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AbsensiGeoMap, pinsFromRecords } from '@/components/absensi/AbsensiGeoMap'
import { AbsensiLokasiCell } from '@/components/absensi/AbsensiLokasiCell'
import { AbsensiMonthCalendar } from '@/components/absensi/AbsensiMonthCalendar'
import { AbsensiMonthChart } from '@/components/absensi/AbsensiMonthChart'
import { FinanceFilterBar } from '@/components/keuangan/FinanceFilterBar'
import { FinancePager } from '@/components/keuangan/FinancePager'
import { FinanceStatGrid } from '@/components/keuangan/FinanceStatGrid'
import { PageSection } from '@/components/ui/PageSection'
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
import type { MetricCardData } from '@/features/dashboard/dashboard-data'
import {
  ATTENDANCE_STATUS_LABEL,
  formatClock,
  hasGeo,
  lastDaysRange,
  todayIsoDate,
  type AttendanceStatus,
} from '@/features/absensi/absensi-data'
import { useAbsensiStore } from '@/features/absensi/absensi-store'
import { useAuth } from '@/features/auth/AuthContext'
import { usePageSize } from '@/features/settings/usePageSize'

function canAudit(role: string | undefined): boolean {
  return role === 'admin' || role === 'hr'
}

type RekapSortKey = 'name' | 'checkIn' | 'checkOut' | 'status'

export function AbsensiRekapPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const { records, ready, persistError } = useAbsensiStore()
  const [date, setDate] = useState(todayIsoDate)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>(
    'all',
  )
  const [sort, setSort] = useState<SortState<RekapSortKey> | null>({
    key: 'name',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)

  const recent = useMemo(() => {
    const range = new Set(lastDaysRange(todayIsoDate(), 35))
    return records.filter((r) => range.has(r.date))
  }, [records])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = records
      .filter((r) => r.date === date)
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => !q || r.userName.toLowerCase().includes(q))
    return sortBy(base, sort, {
      name: (r) => r.userName,
      checkIn: (r) => r.checkIn ?? '',
      checkOut: (r) => r.checkOut ?? '',
      status: (r) => r.status,
    })
  }, [records, date, search, statusFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  const dayPins = useMemo(
    () => pinsFromRecords(records.filter((r) => r.date === date)),
    [records, date],
  )

  const stats = useMemo((): MetricCardData[] => {
    const dayRows = records.filter((r) => r.date === date)
    const hadir = dayRows.filter((r) => r.status === 'hadir').length
    const terlambat = dayRows.filter((r) => r.status === 'terlambat').length
    const withGeo = dayRows.filter((r) => hasGeo(r.checkInGeo)).length
    return [
      {
        label: 'Total absen',
        value: String(dayRows.length),
        delta: `${dayRows.length} orang`,
        positive: true,
      },
      {
        label: 'Tepat waktu',
        value: String(hadir),
        delta: hadir ? 'OK' : 'Kosong',
        positive: true,
      },
      {
        label: 'Terlambat',
        value: String(terlambat),
        delta: terlambat ? 'Perlu perhatian' : 'Kosong',
        positive: terlambat === 0,
      },
      {
        label: 'Dengan lokasi',
        value: String(withGeo),
        delta: `${withGeo} titik masuk`,
        positive: true,
      },
    ]
  }, [records, date])

  if (!user) return null
  if (!canAudit(user.role)) {
    return <Navigate to="/absensi" replace />
  }

  if (!ready) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-line bg-panel">
        <span
          className="size-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-800"
          aria-hidden
        />
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <FinanceStatGrid stats={stats} />

      {persistError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          {persistError}
        </p>
      ) : null}

      <div className="grid gap-2.5 lg:grid-cols-2 lg:items-stretch">
        <AbsensiMonthCalendar
          records={recent}
          selectedDate={date}
          onSelectDate={(iso) => {
            setDate(iso)
            setPage(1)
          }}
        />
        <AbsensiGeoMap
          title="Peta tim"
          subtitle={`Titik check-in/out tanggal ${date}`}
          pins={dayPins}
          emptyHint="Belum ada lokasi pada tanggal ini."
          className="h-full"
        />
      </div>

      <AbsensiMonthChart records={recent} days={30} />

      <PageSection
        title={`Detail ${date}`}
        subtitle="Admin & HR · lokasi hanya untuk audit kehadiran"
      >
        <FinanceFilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Cari nama…"
          filter={statusFilter}
          filterLabel="Status"
          filterOptions={[
            { value: 'all', label: 'Semua status' },
            { value: 'hadir', label: 'Hadir' },
            { value: 'terlambat', label: 'Terlambat' },
            { value: 'izin', label: 'Izin' },
            { value: 'sakit', label: 'Sakit' },
            { value: 'alpha', label: 'Alpha' },
          ]}
          onFilterChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        />

        <FinanceTable minWidth="780px">
          <FinanceThead>
            <FinanceTh className="w-12">No</FinanceTh>
            <FinanceSortTh
              label="Nama"
              sortKey="name"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Masuk"
              sortKey="checkIn"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceSortTh
              label="Keluar"
              sortKey="checkOut"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
            <FinanceTh>Koordinat masuk</FinanceTh>
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
          </FinanceThead>
          <tbody>
            {rows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={6}
                message="Tidak ada data absensi pada tanggal ini."
              />
            ) : (
              rows.map((row, index) => (
                <FinanceTr key={row.id}>
                  <FinanceTd mono muted>
                    {rowNumber(safePage, PAGE_SIZE, index)}
                  </FinanceTd>
                  <FinanceTd>
                    <ActorCell name={row.userName} />
                  </FinanceTd>
                  <FinanceTd mono>{formatClock(row.checkIn)}</FinanceTd>
                  <FinanceTd mono>{formatClock(row.checkOut)}</FinanceTd>
                  <FinanceTd>
                    <AbsensiLokasiCell geo={row.checkInGeo} />
                  </FinanceTd>
                  <FinanceTd>
                    <StatusPill
                      label={ATTENDANCE_STATUS_LABEL[row.status]}
                      tone={
                        row.status === 'hadir'
                          ? 'good'
                          : row.status === 'terlambat'
                            ? 'warn'
                            : 'danger'
                      }
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
