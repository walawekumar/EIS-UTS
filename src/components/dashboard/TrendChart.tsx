type Series = {
  name: string
  color: string
  values: number[]
}

type TrendChartProps = {
  labels: string[]
  series: Series[]
}

export function TrendChart({ labels, series }: TrendChartProps) {
  const width = 520
  const height = 210
  const pad = { top: 8, right: 8, bottom: 26, left: 28 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const all = series.flatMap((s) => s.values)
  const max = Math.max(...all) * 1.08
  const groupCount = labels.length
  const groupGap = 10
  const groupW = (innerW - groupGap * (groupCount - 1)) / groupCount
  const barGap = 3
  const barW = Math.max(
    6,
    (groupW - barGap * Math.max(series.length - 1, 0)) / Math.max(series.length, 1),
  )

  function barHeight(value: number) {
    return Math.max(4, (value / max) * innerH)
  }

  function roundTopRect(x: number, y: number, w: number, h: number, r: number) {
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

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * (1 - t)
          return (
            <line
              key={t}
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="#d5e0d9"
              strokeWidth="1"
            />
          )
        })}

        {labels.map((label, dayIndex) => {
          const groupX = pad.left + dayIndex * (groupW + groupGap)
          const labelX = groupX + groupW / 2

          return (
            <g key={label}>
              {series.map((s, seriesIndex) => {
                const value = s.values[dayIndex] ?? 0
                const h = barHeight(value)
                const x = groupX + seriesIndex * (barW + barGap)
                const y = pad.top + innerH - h
                return (
                  <path
                    key={`${s.name}-${label}`}
                    d={roundTopRect(x, y, barW, h, 5)}
                    fill={s.color}
                    opacity={0.92}
                  />
                )
              })}
              <text
                x={labelX}
                y={height - 8}
                textAnchor="middle"
                fill="#5f6d65"
                style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
