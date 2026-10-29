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
  const width = 640
  const height = 200
  const pad = { top: 12, right: 8, bottom: 24, left: 32 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const all = series.flatMap((s) => s.values)
  const min = Math.min(...all) * 0.92
  const max = Math.max(...all) * 1.04
  const span = max - min || 1

  function pathFor(values: number[]) {
    return values
      .map((v, i) => {
        const x = pad.left + (i / Math.max(values.length - 1, 1)) * innerW
        const y = pad.top + innerH - ((v - min) / span) * innerH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[200px] w-full" role="img">
        {[0, 0.5, 1].map((t) => {
          const y = pad.top + innerH * (1 - t)
          return (
            <line
              key={t}
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="#e5e4df"
              strokeWidth="1"
            />
          )
        })}

        {series.map((s) => (
          <path
            key={s.name}
            d={pathFor(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth="1.75"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
        ))}

        {labels.map((label, i) => {
          const x = pad.left + (i / Math.max(labels.length - 1, 1)) * innerW
          return (
            <text
              key={label}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fill="#6a6864"
              style={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {label}
            </text>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="inline-block h-px w-3" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
