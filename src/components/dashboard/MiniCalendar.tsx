import { useMemo, useState } from 'react'

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/** Senin = 0 … Minggu = 6 */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

type MiniCalendarProps = {
  markedDays?: number[]
}

export function MiniCalendar({ markedDays = [27, 28, 29] }: MiniCalendarProps) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(today)

  const cells = useMemo(() => {
    const total = daysInMonth(cursor)
    const offset = mondayIndex(startOfMonth(cursor))
    const items: Array<{ day: number | null; date: Date | null }> = []

    for (let i = 0; i < offset; i += 1) {
      items.push({ day: null, date: null })
    }
    for (let day = 1; day <= total; day += 1) {
      items.push({
        day,
        date: new Date(cursor.getFullYear(), cursor.getMonth(), day),
      })
    }
    while (items.length % 7 !== 0) {
      items.push({ day: null, date: null })
    }
    return items
  }, [cursor])

  const isCurrentMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth()

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold capitalize text-ink">
          {formatMonthYear(cursor)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
            className="flex size-7 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
            aria-label="Bulan sebelumnya"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
            className="flex size-7 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
            aria-label="Bulan berikutnya"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1 font-mono text-[10px] font-medium tracking-wide text-muted uppercase"
          >
            {d}
          </span>
        ))}

        {cells.map((cell, index) => {
          if (!cell.day || !cell.date) {
            return <span key={`e-${index}`} className="aspect-square" />
          }

          const isToday = sameDay(cell.date, today)
          const isSelected = sameDay(cell.date, selected)
          const isMarked = isCurrentMonth && markedDays.includes(cell.day)

          return (
            <button
              key={cell.day}
              type="button"
              onClick={() => setSelected(cell.date!)}
              className={[
                'relative mx-auto flex aspect-square w-full max-w-8 items-center justify-center rounded-xl text-[12px] transition',
                isSelected
                  ? 'bg-brand-800 font-semibold text-white'
                  : isToday
                    ? 'bg-brand-100 font-semibold text-brand-900'
                    : 'text-ink hover:bg-brand-50',
              ].join(' ')}
            >
              {cell.day}
              {isMarked && !isSelected ? (
                <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-brand-600" />
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="mt-3 border-t border-line pt-2.5 font-mono text-[11px] text-muted">
        Dipilih:{' '}
        <span className="font-medium text-ink">
          {new Intl.DateTimeFormat('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(selected)}
        </span>
      </p>
    </section>
  )
}
