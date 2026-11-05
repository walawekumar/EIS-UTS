import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AbsensiGeoMap, pinsFromRecords } from '@/components/absensi/AbsensiGeoMap'
import { AbsensiHereMap } from '@/components/absensi/AbsensiHereMap'
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
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { usePageSize } from '@/features/settings/usePageSize'
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

function canAudit(role: string | undefined): boolean {
  return role === 'admin' || role === 'hr'
}

type TodaySortKey = 'name' | 'checkIn' | 'checkOut' | 'status'

export function AbsensiPage() {
  const PAGE_SIZE = usePageSize()
  const { user } = useAuth()
  const { records, todayMine, ready, persistError, checkIn, checkOut } =
    useAbsensiStore()
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>(
    'all',
  )
  const [sort, setSort] = useState<SortState<TodaySortKey> | null>({
    key: 'name',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayIsoDate)
  const [now, setNow] = useState(() => new Date())
  const auditor = canAudit(user?.role)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  const today = todayIsoDate()
  const monthMine = useMemo(() => {
    if (!user) return []
    const range = new Set(lastDaysRange(today, 35))
    return records.filter((r) => r.userId === user.id && range.has(r.date))
  }, [records, user, today])

  const todayFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = records
      .filter((r) => r.date === today)
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => !q || r.userName.toLowerCase().includes(q))
    return sortBy(base, sort, {
      name: (r) => r.userName,
      checkIn: (r) => r.checkIn ?? '',
      checkOut: (r) => r.checkOut ?? '',
      status: (r) => r.status,
    })
  }, [records, today, search, statusFilter, sort])

  const pageCount = Math.max(1, Math.ceil(todayFiltered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const todayRows = todayFiltered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  const stats = useMemo((): MetricCardData[] => {
    const day = records.filter((r) => r.date === today)
    const hadir = day.filter((r) => r.status === 'hadir').length
    const terlambat = day.filter((r) => r.status === 'terlambat').length
    const mineLabel = todayMine
      ? ATTENDANCE_STATUS_LABEL[todayMine.status]
      : 'Belum absen'
    return [
      {
        label: 'Kehadiran hari ini',
        value: String(day.length),
        delta: day.length ? `${day.length} orang` : 'Kosong',
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
        label: 'Status Anda',
        value: mineLabel,
        delta: 'Hari ini',
        positive: mineLabel !== 'Belum absen',
      },
    ]
  }, [records, today, todayMine])

  const myPins = useMemo(
    () => (user ? pinsFromRecords(monthMine, { userId: user.id }) : []),
    [monthMine, user],
  )

  const clock = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  if (!user) return null

  if (!ready) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-line bg-panel">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="size-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-800"
            aria-hidden
          />
          <p className="text-[13px] text-muted">Memuat absensi…</p>
        </div>
      </div>
    )
  }

  async function handleIn() {
    setBusy(true)
    const err = await checkIn()
    setBusy(false)
    setToast(err ?? 'Check-in tercatat dengan lokasi')
  }

  async function handleOut() {
    setBusy(true)
    const err = await checkOut()
    setBusy(false)
    setToast(err ?? 'Check-out tercatat dengan lokasi')
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
        <div className="flex flex-col gap-2.5">
        <AbsensiHereMap />
        <PageSection
          title="Check-in / out"
          subtitle={clock}
          actions={<FinanceToast message={toast} />}
        >

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3">
              <p className="text-[11px] text-muted">Masuk</p>
              <p className="num mt-1 text-[20px] font-semibold text-ink">
                {formatClock(todayMine?.checkIn)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {hasGeo(todayMine?.checkInGeo)
                  ? `${todayMine!.checkInGeo!.lat.toFixed(4)}, ${todayMine!.checkInGeo!.lng.toFixed(4)}`
                  : 'Lokasi belum ada'}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3">
              <p className="text-[11px] text-muted">Keluar</p>
              <p className="num mt-1 text-[20px] font-semibold text-ink">
                {formatClock(todayMine?.checkOut)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {hasGeo(todayMine?.checkOutGeo)
                  ? `${todayMine!.checkOutGeo!.lat.toFixed(4)}, ${todayMine!.checkOutGeo!.lng.toFixed(4)}`
                  : 'Lokasi belum ada'}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3">
              <p className="text-[11px] text-muted">Status</p>
              <div className="mt-2">
                {todayMine ? (
                  <StatusPill
                    label={ATTENDANCE_STATUS_LABEL[todayMine.status]}
                    tone={
                      todayMine.status === 'hadir'
                        ? 'good'
                        : todayMine.status === 'terlambat'
                          ? 'warn'
                          : 'danger'
                    }
                  />
                ) : (
                  <span className="text-[13px] text-muted">Belum absen</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleIn()}
              disabled={busy || Boolean(todayMine?.checkIn)}
              className="h-11 rounded-xl bg-brand-800 px-4 text-[14px] font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check-in
            </button>
            <button
              type="button"
              onClick={() => void handleOut()}
              disabled={
                busy || !todayMine?.checkIn || Boolean(todayMine?.checkOut)
              }
              className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check-out
            </button>
            <Link
              to="/absensi/cuti"
              className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-medium text-ink transition hover:bg-brand-50"
            >
              Cuti & izin
            </Link>
            {auditor ? (
              <Link
                to="/absensi/rekap"
                className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-medium text-ink transition hover:bg-brand-50"
              >
                Rekap & peta tim
              </Link>
            ) : null}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            Lokasi perangkat wajib saat check-in/out. Data lokasi hanya terlihat
            oleh Anda, HR, dan admin.
          </p>
        </PageSection>
        </div>

        <AbsensiMonthCalendar
          records={monthMine}
          userId={user.id}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      <AbsensiMonthChart records={monthMine} userId={user.id} days={30} />

      <AbsensiGeoMap
        title="Titik absensi Anda"
        subtitle="30 hari terakhir · masuk (hijau) dan keluar (biru)"
        pins={myPins}
        emptyHint="Belum ada titik. Lakukan check-in dengan izin lokasi."
        mapClassName="h-[220px] w-full sm:h-[280px]"
      />

      <PageSection
        title="Daftar kehadiran hari ini"
        subtitle={
          auditor
            ? 'Semua karyawan sesuai hak akses Anda'
            : 'Data sesuai hak akses akun Anda'
        }
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
            <FinanceTh>Lokasi</FinanceTh>
            <FinanceSortTh
              label="Status"
              sortKey="status"
              sort={sort}
              onSort={(key) => setSort((prev) => toggleSort(prev, key))}
            />
          </FinanceThead>
          <tbody>
            {todayRows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={6}
                message="Belum ada check-in. Tekan Check-in untuk memulai."
              />
            ) : (
              todayRows.map((row, index) => (
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
          total={todayFiltered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </PageSection>
    </div>
  )
}
