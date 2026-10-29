type RangeTabsProps = {
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
}

export function RangeTabs({ value, options, onChange }: RangeTabsProps) {
  return (
    <div className="inline-flex border border-line">
      {options.map((opt, i) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              'px-2.5 py-1 font-mono text-[11px] transition',
              i > 0 ? 'border-l border-line' : '',
              active ? 'bg-brand-800 text-white' : 'bg-panel text-muted hover:text-ink',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
