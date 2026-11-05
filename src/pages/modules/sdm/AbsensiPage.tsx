import { useEffect, useMemo, useState } from 'react'
import {
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  ATTENDANCE_STATUS_LABEL,
  formatClock,
  todayIsoDate,
} from '@/features/absensi/absensi-data'
import { useAbsensiStore } from '@/features/absensi/absensi-store'
import { useAuth } from '@/features/auth/AuthContext'

export function AbsensiPage() {
  const { user } = useAuth()
  const { records, todayMine, persistError, checkIn, checkOut } =
    useAbsensiStore()
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const todayRows = useMemo(
    () => records.filter((r) => r.date === todayIsoDate()),
    [records],
  )

  if (!user) return null

  function handleIn() {
    const err = checkIn()
    setToast(err ?? 'Check-in tercatat')
  }

  function handleOut() {
    const err = checkOut()
    setToast(err ?? 'Check-out tercatat')
  }

  const clock = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Absensi hari ini</h2>
            <p className="mt-0.5 text-[12px] text-muted capitalize">{clock}</p>
          </div>
          <FinanceToast message={toast ?? persistError} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface/70 px-3.5 py-3">
            <p className="text-[11px] text-muted">Check-in</p>
            <p className="num mt-1 text-[20px] font-semibold text-ink">
              {formatClock(todayMine?.checkIn)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface/70 px-3.5 py-3">
            <p className="text-[11px] text-muted">Check-out</p>
            <p className="num mt-1 text-[20px] font-semibold text-ink">
              {formatClock(todayMine?.checkOut)}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface/70 px-3.5 py-3">
            <p className="text-[11px] text-muted">Status</p>
            <div className="mt-1.5">
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
            onClick={handleIn}
            disabled={Boolean(todayMine?.checkIn)}
            className="h-11 rounded-xl bg-brand-800 px-4 text-[14px] font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check-in
          </button>
          <button
            type="button"
            onClick={handleOut}
            disabled={!todayMine?.checkIn || Boolean(todayMine?.checkOut)}
            className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check-out
          </button>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Aplikasi E-Absensi terpisah dari E-Gabah (masuk lewat Portal). Sinkron
          cloud, geofence, dan laporan bulanan menyusul.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h3 className="mb-3 text-[14px] font-semibold text-ink">Kehadiran hari ini</h3>
        <FinanceTable minWidth="640px">
          <FinanceThead>
            <FinanceTh>Nama</FinanceTh>
            <FinanceTh>Masuk</FinanceTh>
            <FinanceTh>Keluar</FinanceTh>
            <FinanceTh>Status</FinanceTh>
          </FinanceThead>
          <tbody>
            {todayRows.length === 0 ? (
              <FinanceEmptyRow
                colSpan={4}
                message="Belum ada check-in. Tekan Check-in untuk memulai."
              />
            ) : (
              todayRows.map((row) => (
                <FinanceTr key={row.id}>
                  <FinanceTd className="font-medium">{row.userName}</FinanceTd>
                  <FinanceTd mono>{formatClock(row.checkIn)}</FinanceTd>
                  <FinanceTd mono>{formatClock(row.checkOut)}</FinanceTd>
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
      </section>
    </div>
  )
}
