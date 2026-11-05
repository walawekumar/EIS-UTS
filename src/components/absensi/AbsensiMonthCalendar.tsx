import { useMemo, useState } from 'react'
import { PageSection } from '@/components/ui/PageSection'
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/features/absensi/absensi-data'

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const STATUS_DOT: Record<AttendanceStatus, string> = {
  hadir: 'bg-brand-600',
  terlambat: 'bg-amber-500',
  izin: 'bg-sky-500',
  sakit: 'bg-violet-500',
  alpha: 'bg-red-500',
}

type AbsensiMonthCalendarProps = {
  records: AttendanceRecord[]
  /** Filter ke satu user (pegawai melihat miliknya). */
  userId?: string
  onSelectDate?: (iso: string) => void
  selectedDate?: string
}

function toIso(y: number, m0: number, day: number): string {
  const m = String(m0 + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function mondayIndex(d: Date) {
  return (d.getDay() + 6) % 7
}

export function AbsensiMonthCalendar({
  records,
  userId,
  onSelectDate,
  selectedDate,
}: AbsensiMonthCalendarProps) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()
    for (const r of records) {
      if (userId && r.userId !== userId) continue
      map.set(r.date, r)
    }
    return map
  }, [records, userId])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const daysCount = new Date(year, month + 1, 0).getDate()
  const lead = mondayIndex(new Date(year, month, 1))
  const cells: Array<{ iso: string; day: number } | null> = []
  for (let i = 0; i < lead; i += 1) cells.push(null)
  for (let day = 1; day <= daysCount; day += 1) {
    cells.push({ iso: toIso(year, month, day), day })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const title = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(cursor)

  return (
    <PageSection
      title={title}
      subtitle="Kalender kehadiran"
      className="flex h-full flex-col [&_h2]:capitalize"
      actions={
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-line text-ink transition hover:bg-brand-50"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-line text-ink transition hover:bg-brand-50"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            ›
          </button>
        </div>
      }
    >
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-[11px] font-medium text-muted"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`e-${idx}`} className="min-h-11 rounded-lg" />
          }
          const row = byDate.get(cell.iso)
          const isToday =
            cell.iso ===
            toIso(today.getFullYear(), today.getMonth(), today.getDate())
          const selected = selectedDate === cell.iso
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDate?.(cell.iso)}
              className={[
                'relative flex min-h-11 flex-col items-center justify-center rounded-xl text-[13px] transition',
                selected
                  ? 'bg-brand-800 text-white'
                  : isToday
                    ? 'bg-brand-50 text-brand-900'
                    : 'text-ink hover:bg-surface',
              ].join(' ')}
              title={
                row
                  ? ATTENDANCE_STATUS_LABEL[row.status]
                  : undefined
              }
            >
              <span className="font-medium">{cell.day}</span>
              {row ? (
                <span
                  className={[
                    'mt-1 size-1.5 rounded-full',
                    selected ? 'bg-white' : STATUS_DOT[row.status],
                  ].join(' ')}
                />
              ) : (
                <span className="mt-1 size-1.5" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 text-[11px] text-muted">
        {(Object.keys(STATUS_DOT) as AttendanceStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${STATUS_DOT[s]}`} />
            {ATTENDANCE_STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </PageSection>
  )
}
