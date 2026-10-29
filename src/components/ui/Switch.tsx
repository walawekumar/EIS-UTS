type SwitchProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ id, label, checked, onChange }: SwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="cursor-pointer text-sm text-muted">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-brand-700' : 'bg-line',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
