import type { InputHTMLAttributes, ReactNode } from 'react'

type TextFieldProps = {
  id: string
  label: string
  requiredMark?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  error?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>

export function TextField({
  id,
  label,
  requiredMark = false,
  leading,
  trailing,
  error,
  className,
  readOnly,
  disabled,
  ...props
}: TextFieldProps) {
  const locked = Boolean(readOnly || disabled)
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={[
          'mb-1.5 block text-[13px] font-medium',
          locked ? 'text-muted' : 'text-ink',
        ].join(' ')}
      >
        {label}
        {requiredMark ? <span className="ml-0.5 text-brand-600">*</span> : null}
      </label>
      <div
        className={[
          'group flex h-11 items-center gap-2.5 rounded-xl border px-3 transition',
          locked
            ? 'cursor-not-allowed border-line/70 bg-surface text-muted'
            : error
              ? 'border-red-300 bg-panel focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100'
              : 'border-line bg-panel focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100',
        ].join(' ')}
      >
        {leading ? (
          <span className="shrink-0 text-muted/80 [&_svg]:size-[18px]">{leading}</span>
        ) : null}
        <input
          id={id}
          readOnly={readOnly}
          disabled={disabled}
          className={[
            'h-full w-full bg-transparent text-sm outline-none placeholder:text-muted/55',
            locked
              ? 'cursor-not-allowed text-muted'
              : 'text-ink',
          ].join(' ')}
          {...props}
        />
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
