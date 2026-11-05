import { useMemo, useState } from 'react'
import { PageSection } from '@/components/ui/PageSection'
import {
  lastDaysRange,
  todayIsoDate,
  type AttendanceRecord,
} from '@/features/absensi/absensi-data'

type AbsensiMonthChartProps = {
  records: AttendanceRecord[]
  userId?: string
  days?: number
  /** Tampilkan pilihan rentang hari di header. */
  showRangeFilter?: boolean
  onDaysChange?: (days: number) => void
  className?: string
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

type DayBucket = {
  iso: string
  label: string
  month: string
  hadir: number
  terlambat: number
  izin: number
}

export function AbsensiMonthChart({
  records,
  userId,
  days = 30,
  showRangeFilter = false,
  onDaysChange,
  className,
}: AbsensiMonthChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const ranges = [7, 14, 30] as const

  const buckets = useMemo((): DayBucket[] => {
    const range = lastDaysRange(todayIsoDate(), days)
    const filtered = userId
      ? records.filter((r) => r.userId === userId)
      : records
    return range.map((iso) => {
      const dayRows = filtered.filter((r) => r.date === iso)
      const d = new Date(`${iso}T12:00:00`)
      return {
        iso,
        label: String(d.getDate()),
        month: MONTH_SHORT[d.getMonth()] ?? '',
        hadir: dayRows.filter((r) => r.status === 'hadir').length,
        terlambat: dayRows.filter((r) => r.status === 'terlambat').length,
        izin: dayRows.filter(
          (r) => r.status === 'izin' || r.status === 'sakit',
        ).length,
      }
    })
  }, [records, userId, days])

  const max = Math.max(
    1,
    ...buckets.map((b) => b.hadir + b.terlambat + b.izin),
  )

  const width = 1200
  const height = 280
  const pad = { top: 12, right: 8, bottom: 30, left: 32 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const gap = 2
  const barW = Math.max(6, (innerW - gap * Math.max(0, buckets.length - 1)) / buckets.length)

  const tip = hover != null ? buckets[hover] : null

  return (
    <PageSection
      title="Kehadiran"
      subtitle={`${days} hari terakhir`}
      className={['flex h-full flex-col', className ?? ''].join(' ')}
      actions={
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted sm:gap-3">
          {showRangeFilter && onDaysChange ? (
            <div className="flex rounded-lg border border-line p-0.5">
              {ranges.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onDaysChange(n)}
                  className={[
                    'rounded-md px-2 py-1 text-[11px] font-medium transition',
                    days === n
                      ? 'bg-brand-800 text-white'
                      : 'text-muted hover:text-ink',
                  ].join(' ')}
                >
                  {n}h
                </button>
              ))}
            </div>
          ) : null}
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="size-2 rounded-sm bg-brand-700" /> Hadir
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="size-2 rounded-sm bg-amber-500" /> Telat
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="size-2 rounded-sm bg-sky-500" /> Izin
          </span>
        </div>
      }
    >
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[220px] w-full sm:h-[280px]"
          role="img"
          aria-label={`Grafik absensi ${days} hari`}
        >
          {[0, Math.ceil(max / 2), max].filter((v, i, arr) => arr.indexOf(v) === i).map((tick) => {
            const y = pad.top + innerH * (1 - tick / max)
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-line"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted text-[10px]"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {buckets.map((b, i) => {
            const x = pad.left + i * (barW + gap)
            const total = b.hadir + b.terlambat + b.izin
            let y = pad.top + innerH
            const segments = [
              { v: b.hadir, color: '#216348' },
              { v: b.terlambat, color: '#f59e0b' },
              { v: b.izin, color: '#0ea5e9' },
            ]
            return (
              <g
                key={b.iso}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {segments.map((seg) => {
                  if (seg.v <= 0) return null
                  const h = (seg.v / max) * innerH
                  y -= h
                  return (
                    <rect
                      key={seg.color}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(h, 1)}
                      fill={seg.color}
                      rx={i === hover ? 3 : 2}
                      opacity={hover == null || hover === i ? 1 : 0.35}
                    />
                  )
                })}
                {total === 0 ? (
                  <rect
                    x={x}
                    y={pad.top + innerH - 2}
                    width={barW}
                    height={2}
                    fill="#d5e0d9"
                    rx={1}
                  />
                ) : null}
                {i === 0 ||
                i === buckets.length - 1 ||
                i % 3 === 0 ||
                buckets[i - 1]?.iso.slice(0, 7) !== b.iso.slice(0, 7) ? (
                  <text
                    x={x + barW / 2}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-muted text-[9px]"
                  >
                    {i === 0 ||
                    buckets[i - 1]?.iso.slice(0, 7) !== b.iso.slice(0, 7)
                      ? `${b.label} ${b.month}`
                      : b.label}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        {tip ? (
          <div className="pointer-events-none absolute top-2 right-3 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11px] text-ink shadow-sm">
            <p className="font-medium">{tip.iso}</p>
            <p className="text-muted">
              H {tip.hadir} · T {tip.terlambat} · I {tip.izin}
            </p>
          </div>
        ) : null}
      </div>
    </PageSection>
  )
}
