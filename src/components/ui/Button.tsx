import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = {
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={[
        'inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-brand-800 px-4 text-sm font-semibold text-white transition',
        'hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Memproses…
        </span>
      ) : (
        children
      )}
    </button>
  )
}
