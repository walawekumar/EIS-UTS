import { useMemo, useState } from 'react'

type Series = {
  name: string
  color: string
  values: number[]
}

type TrendChartProps = {
  labels: string[]
  series: Series[]
}

type HoverState = {
  dayIndex: number
  seriesIndex: number | null
  x: number
  y: number
}

function stackPath(
  x: number,
  y: number,
  w: number,
  h: number,
  roundTop: boolean,
  roundBottom: boolean,
  r = 8,
) {
  if (h <= 0) return ''
  const radius = Math.min(r, w / 2, h / 2)

  if (roundTop && roundBottom) {
    return [
      `M${x + radius} ${y + h}`,
      `Q${x} ${y + h} ${x} ${y + h - radius}`,
      `L${x} ${y + radius}`,
      `Q${x} ${y} ${x + radius} ${y}`,
      `L${x + w - radius} ${y}`,
      `Q${x + w} ${y} ${x + w} ${y + radius}`,
      `L${x + w} ${y + h - radius}`,
      `Q${x + w} ${y + h} ${x + w - radius} ${y + h}`,
      'Z',
    ].join(' ')
  }

  if (roundTop) {
    return [
      `M${x} ${y + h}`,
      `L${x} ${y + radius}`,
      `Q${x} ${y} ${x + radius} ${y}`,
      `L${x + w - radius} ${y}`,
      `Q${x + w} ${y} ${x + w} ${y + radius}`,
      `L${x + w} ${y + h}`,
      'Z',
    ].join(' ')
  }

  if (roundBottom) {
    return [
      `M${x} ${y}`,
      `L${x} ${y + h - radius}`,
      `Q${x} ${y + h} ${x + radius} ${y + h}`,
      `L${x + w - radius} ${y + h}`,
      `Q${x + w} ${y + h} ${x + w} ${y + h - radius}`,
      `L${x + w} ${y}`,
      'Z',
    ].join(' ')
  }

  return `M${x} ${y} H${x + w} V${y + h} H${x} Z`
}

export function TrendChart({ labels, series }: TrendChartProps) {
  const [hover, setHover] = useState<HoverState | null>(null)
  const [activeSeries, setActiveSeries] = useState<string | null>(null)

  const width = 760
  const height = 320
  const pad = { top: 16, right: 12, bottom: 34, left: 40 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const dayTotals = labels.map((_, dayIndex) =>
    series.reduce((sum, s) => sum + (s.values[dayIndex] ?? 0), 0),
  )
  const max = Math.max(...dayTotals, 1) * 1.12
  const count = labels.length
  const gap = 14
  const barW = Math.max(18, (innerW - gap * (count - 1)) / count)

  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  const segments = useMemo(() => {
    return labels.flatMap((label, dayIndex) => {
      const x = pad.left + dayIndex * (barW + gap)
      let stacked = 0
      return series.map((s, seriesIndex) => {
        const value = s.values[dayIndex] ?? 0
        const h = (value / max) * innerH
        const y = pad.top + innerH - stacked - h
        stacked += h
        const isBottom = seriesIndex === 0
        const isTop = seriesIndex === series.length - 1
        return {
          key: `${s.name}-${label}`,
          label,
          dayIndex,
          seriesIndex,
          seriesName: s.name,
          color: s.color,
          value,
          total: dayTotals[dayIndex] ?? 0,
          x,
          y,
          w: barW,
          h: Math.max(h, value > 0 ? 2 : 0),
          isBottom,
          isTop,
          patterned: seriesIndex === series.length - 1,
        }
      })
    })
  }, [labels, series, max, barW, gap, innerH, pad.left, pad.top, dayTotals])

  const tipDay = hover?.dayIndex
  const tipSeg =
    tipDay != null && hover?.seriesIndex != null
      ? segments.find(
          (s) => s.dayIndex === tipDay && s.seriesIndex === hover.seriesIndex,
        )
      : null

  function setHoverFromEvent(
    event: React.MouseEvent<SVGElement>,
    dayIndex: number,
    seriesIndex: number | null,
  ) {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setHover({
      dayIndex,
      seriesIndex,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <div className="flex h-full min-h-[280px] w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full min-h-[260px] w-full"
          role="img"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <pattern
              id="stack-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="2" opacity="0.35" />
            </pattern>
          </defs>

          {yTicks.map((t) => {
            const y = pad.top + innerH * (1 - t)
            const value = Math.round(max * t)
            return (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke="#d5e0d9"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#5f6d65"
                  style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {value}
                </text>
              </g>
            )
          })}

          {labels.map((label, dayIndex) => {
            const x = pad.left + dayIndex * (barW + gap) + barW / 2
            const active = hover?.dayIndex === dayIndex
            return (
              <text
                key={label}
                x={x}
                y={height - 10}
                textAnchor="middle"
                fill={active ? '#216348' : '#5f6d65'}
                style={{
                  fontSize: 11,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </text>
            )
          })}

          {segments.map((seg) => {
            if (seg.h <= 0) return null
            const isHovered =
              hover?.dayIndex === seg.dayIndex &&
              (hover.seriesIndex == null || hover.seriesIndex === seg.seriesIndex)
            const seriesDimmed =
              activeSeries != null && activeSeries !== seg.seriesName
            const dayDimmed = hover != null && hover.dayIndex !== seg.dayIndex

            return (
              <g key={seg.key}>
                <path
                  d={stackPath(
                    seg.x,
                    seg.y,
                    seg.w,
                    seg.h,
                    seg.isTop,
                    seg.isBottom,
                    9,
                  )}
                  fill={seg.color}
                  opacity={seriesDimmed || dayDimmed ? 0.25 : isHovered ? 1 : 0.95}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={(e) => setHoverFromEvent(e, seg.dayIndex, seg.seriesIndex)}
                  onMouseMove={(e) => setHoverFromEvent(e, seg.dayIndex, seg.seriesIndex)}
                />
                {seg.patterned ? (
                  <path
                    d={stackPath(
                      seg.x,
                      seg.y,
                      seg.w,
                      seg.h,
                      seg.isTop,
                      seg.isBottom,
                      9,
                    )}
                    fill="url(#stack-hatch)"
                    opacity={seriesDimmed || dayDimmed ? 0.15 : 0.55}
                    className="pointer-events-none"
                  />
                ) : null}
              </g>
            )
          })}
        </svg>

        {tipSeg && hover ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[112%] rounded-xl border border-line bg-panel px-2.5 py-2 shadow-md"
            style={{
              left: `${Math.min(90, Math.max(10, hover.x))}%`,
              top: `${Math.max(10, hover.y)}%`,
            }}
          >
            <p className="font-mono text-[10px] text-muted">{tipSeg.label}</p>
            <div className="mt-1 space-y-0.5">
              {series.map((s, i) => (
                <p key={s.name} className="flex items-center gap-1.5 text-[11px] text-ink">
                  <span
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="min-w-16">{s.name}</span>
                  <span className="num font-semibold">
                    {(s.values[tipSeg.dayIndex] ?? 0).toLocaleString('id-ID')}
                  </span>
                  {i === tipSeg.seriesIndex ? (
                    <span className="text-[10px] text-brand-700">●</span>
                  ) : null}
                </p>
              ))}
            </div>
            <p className="mt-1.5 border-t border-line pt-1 font-mono text-[11px] text-muted">
              Total{' '}
              <span className="font-semibold text-ink">
                {tipSeg.total.toLocaleString('id-ID')}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 border-t border-line pt-2">
        {series.map((s, index) => {
          const active = activeSeries === s.name
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => setActiveSeries((cur) => (cur === s.name ? null : s.name))}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition',
                active
                  ? 'bg-brand-100 font-semibold text-brand-900'
                  : 'text-muted hover:bg-brand-50 hover:text-ink',
              ].join(' ')}
            >
              <span
                className="relative inline-block size-2.5 overflow-hidden rounded-sm"
                style={{ backgroundColor: s.color }}
              >
                {index === series.length - 1 ? (
                  <span
                    className="absolute inset-0 opacity-50"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(255,255,255,0.55) 1px, rgba(255,255,255,0.55) 2px)',
                    }}
                  />
                ) : null}
              </span>
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
