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

function barPath(x: number, y: number, w: number, h: number, r = 5) {
  if (h <= 0) return ''
  const radius = Math.min(r, w / 2, h / 2)
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

/** Grouped bars (side-by-side sticks) — pola ERP sales vs purchase vs cash. */
export function TrendChart({ labels, series }: TrendChartProps) {
  const [hover, setHover] = useState<HoverState | null>(null)
  const [activeSeries, setActiveSeries] = useState<string | null>(null)

  const width = 760
  const height = 420
  const pad = { top: 12, right: 12, bottom: 36, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const max = Math.max(
    1,
    ...series.flatMap((s) => s.values),
  ) * 1.12

  const count = Math.max(labels.length, 1)
  const groupGap = labels.length > 14 ? 6 : 12
  const groupW = Math.max(22, (innerW - groupGap * (count - 1)) / count)
  const barGap = 2
  const barW = Math.max(
    4,
    (groupW - barGap * Math.max(0, series.length - 1)) / Math.max(series.length, 1),
  )

  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  const segments = useMemo(() => {
    return labels.flatMap((label, dayIndex) => {
      const groupX = pad.left + dayIndex * (groupW + groupGap)
      return series.map((s, seriesIndex) => {
        const value = s.values[dayIndex] ?? 0
        const h = (value / max) * innerH
        const x = groupX + seriesIndex * (barW + barGap)
        const y = pad.top + innerH - h
        return {
          key: `${s.name}-${label}-${dayIndex}`,
          label,
          dayIndex,
          seriesIndex,
          seriesName: s.name,
          color: s.color,
          value,
          x,
          y,
          w: barW,
          h: Math.max(h, value > 0 ? 2 : 0),
        }
      })
    })
  }, [labels, series, max, groupW, groupGap, barW, barGap, innerH, pad.left, pad.top])

  const tipDay = hover?.dayIndex

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
    <div className="flex h-full min-h-[360px] w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full min-h-[340px] w-full"
          role="img"
          onMouseLeave={() => setHover(null)}
        >
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
            const x = pad.left + dayIndex * (groupW + groupGap) + groupW / 2
            const active = hover?.dayIndex === dayIndex
            const dense = labels.length > 14
            return (
              <text
                key={`${label}-${dayIndex}`}
                x={x}
                y={height - 10}
                textAnchor="middle"
                fill={active ? '#216348' : '#5f6d65'}
                style={{
                  fontSize: dense ? 9 : 11,
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
              <path
                key={seg.key}
                d={barPath(seg.x, seg.y, seg.w, seg.h)}
                fill={seg.color}
                opacity={seriesDimmed || dayDimmed ? 0.22 : isHovered ? 1 : 0.92}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={(e) =>
                  setHoverFromEvent(e, seg.dayIndex, seg.seriesIndex)
                }
                onMouseMove={(e) =>
                  setHoverFromEvent(e, seg.dayIndex, seg.seriesIndex)
                }
              />
            )
          })}
        </svg>

        {tipDay != null && hover ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[112%] rounded-xl border border-line bg-panel px-2.5 py-2 shadow-md"
            style={{
              left: `${Math.min(90, Math.max(10, hover.x))}%`,
              top: `${Math.max(10, hover.y)}%`,
            }}
          >
            <p className="font-mono text-[10px] text-muted">
              {labels[tipDay]}
            </p>
            <div className="mt-1 space-y-0.5">
              {series.map((s, i) => (
                <p
                  key={s.name}
                  className="flex items-center gap-1.5 text-[11px] text-ink"
                >
                  <span
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="min-w-16">{s.name}</span>
                  <span className="num font-semibold">
                    {(s.values[tipDay] ?? 0).toLocaleString('id-ID')}
                  </span>
                  {i === hover.seriesIndex ? (
                    <span className="text-[10px] text-brand-700">●</span>
                  ) : null}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 border-t border-line pt-2">
        {series.map((s) => {
          const active = activeSeries === s.name
          return (
            <button
              key={s.name}
              type="button"
              onClick={() =>
                setActiveSeries((cur) => (cur === s.name ? null : s.name))
              }
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition',
                active
                  ? 'bg-brand-100 font-semibold text-brand-900'
                  : 'text-muted hover:bg-brand-50 hover:text-ink',
              ].join(' ')}
            >
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
