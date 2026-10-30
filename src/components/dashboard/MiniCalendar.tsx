import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  buildEventMap,
  dateKey,
  type CalendarEvent,
  type CalendarEventTone,
} from '@/features/dashboard/calendar-events'

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const TONE_STYLE: Record<
  CalendarEventTone,
  { badge: string; dot: string; label: string }
> = {
  deadline: {
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-600',
    label: 'Deadline',
  },
  ops: {
    badge: 'bg-brand-100 text-brand-800',
    dot: 'bg-brand-600',
    label: 'Operasional',
  },
  info: {
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
    label: 'Info',
  },
}

type MenuPos = {
  top?: number
  bottom?: number
  left: number
  width: number
}

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

function formatSelected(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function MiniCalendar({ events }: { events: CalendarEvent[] }) {
  const today = useMemo(() => new Date(), [])
  const eventMap = useMemo(() => buildEventMap(events), [events])
  const [cursor, setCursor] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(today)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)

  const rootRef = useRef<HTMLElement>(null)
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const menuRef = useRef<HTMLDivElement>(null)

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

  const selectedEvents: CalendarEvent[] =
    eventMap.get(dateKey(selected)) ?? []

  function dayHasEvents(date: Date) {
    return (eventMap.get(dateKey(date))?.length ?? 0) > 0
  }

  function dayTone(date: Date): CalendarEventTone | null {
    const list = eventMap.get(dateKey(date))
    if (!list?.length) return null
    if (list.some((e) => e.tone === 'deadline')) return 'deadline'
    if (list.some((e) => e.tone === 'ops')) return 'ops'
    return 'info'
  }

  function computePosition(trigger: HTMLElement): MenuPos {
    const rect = trigger.getBoundingClientRect()
    const width = 260
    const gap = 6
    const pad = 12
    const spaceBelow = window.innerHeight - rect.bottom - pad
    const spaceAbove = rect.top - pad
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow

    let left = rect.left + rect.width / 2 - width / 2
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad))

    if (openUp) {
      return {
        left,
        width,
        bottom: window.innerHeight - rect.top + gap,
      }
    }

    return {
      left,
      width,
      top: rect.bottom + gap,
    }
  }

  function openForDate(date: Date) {
    const key = dateKey(date)
    const trigger = dayRefs.current.get(key)
    setSelected(date)
    if (open && sameDay(selected, date)) {
      setOpen(false)
      setPos(null)
      return
    }
    if (trigger) setPos(computePosition(trigger))
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    const key = dateKey(selected)
    const trigger = dayRefs.current.get(key)
    if (trigger) setPos(computePosition(trigger))
  }, [open, selected])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      if (rootRef.current?.contains(target)) return
      setOpen(false)
      setPos(null)
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setPos(null)
      }
    }

    function onReposition() {
      const trigger = dayRefs.current.get(dateKey(selected))
      if (trigger) setPos(computePosition(trigger))
      else {
        setOpen(false)
        setPos(null)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, selected])

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label={`Agenda ${formatSelected(selected)}`}
            className="z-50 overflow-hidden rounded-2xl border border-line bg-panel shadow-lg"
            style={{
              position: 'fixed',
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: 280,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
              <p className="text-[12px] font-semibold capitalize text-ink">
                {formatSelected(selected)}
              </p>
              <span className="font-mono text-[10px] text-muted">
                {selectedEvents.length} agenda
              </span>
            </div>

            {selectedEvents.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-muted">
                Tidak ada deadline atau jadwal pada tanggal ini.
              </p>
            ) : (
              <ul className="max-h-56 space-y-0 overflow-y-auto py-1">
                {selectedEvents.map((event) => {
                  const style = TONE_STYLE[event.tone]
                  return (
                    <li key={event.id} className="px-2.5 py-1">
                      <div className="rounded-xl border border-line bg-surface/70 px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12px] leading-snug font-medium text-ink">
                            {event.title}
                          </p>
                          <span
                            className={[
                              'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                              style.badge,
                            ].join(' ')}
                          >
                            {style.label}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted">
                          {event.meta}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <section ref={rootRef} className="relative">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold capitalize text-ink">
          {formatMonthYear(cursor)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }}
            className="flex size-7 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
            aria-label="Bulan sebelumnya"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(startOfMonth(today))
              openForDate(today)
            }}
            className="rounded-lg border border-line px-2 py-1 font-mono text-[10px] text-muted transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }}
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
          const isSelected = open && sameDay(cell.date, selected)
          const hasEvents = dayHasEvents(cell.date)
          const tone = dayTone(cell.date)
          const key = dateKey(cell.date)

          return (
            <button
              key={cell.day}
              type="button"
              ref={(node) => {
                if (node) dayRefs.current.set(key, node)
                else dayRefs.current.delete(key)
              }}
              onClick={() => openForDate(cell.date!)}
              aria-haspopup="dialog"
              aria-expanded={isSelected}
              title={
                hasEvents
                  ? `${eventMap.get(key)!.length} agenda`
                  : undefined
              }
              className={[
                'relative mx-auto flex aspect-square w-full max-w-8 items-center justify-center rounded-xl text-[12px] transition',
                isSelected
                  ? 'bg-brand-800 font-semibold text-white'
                  : isToday
                    ? 'bg-brand-100 font-semibold text-brand-900'
                    : hasEvents
                      ? 'font-medium text-ink hover:bg-brand-50'
                      : 'text-ink hover:bg-brand-50',
              ].join(' ')}
            >
              {cell.day}
              {hasEvents ? (
                <span
                  className={[
                    'absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full',
                    isSelected
                      ? 'bg-white'
                      : tone
                        ? TONE_STYLE[tone].dot
                        : 'bg-brand-600',
                  ].join(' ')}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      {menu}
    </section>
  )
}
