type RangeTabsProps = {
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
}

export function RangeTabs({ value, options, onChange }: RangeTabsProps) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              'rounded-lg px-2.5 py-1 font-mono text-[11px] transition',
              active
                ? 'bg-brand-800 text-white shadow-sm'
                : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
