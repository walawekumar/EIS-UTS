import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type FinanceModalProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function FinanceModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: FinanceModalProps) {
  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEscape)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Tutup"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-modal-title"
        className={[
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-lg' : 'sm:max-w-md',
        ].join(' ')}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {subtitle ? (
              <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                {subtitle}
              </p>
            ) : null}
            <h2
              id="finance-modal-title"
              className="truncate text-[16px] font-semibold text-ink"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-brand-50 hover:text-ink"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="scrollbar-brand min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-line px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function DetailFields({
  fields,
}: {
  fields: Array<{ label: string; value: string }>
}) {
  return (
    <dl className="divide-y divide-line rounded-xl border border-line">
      {fields.map((field) => (
        <div
          key={field.label}
          className="flex items-start justify-between gap-4 px-3.5 py-2.5 text-[13px]"
        >
          <dt className="shrink-0 text-muted">{field.label}</dt>
          <dd className="text-right font-medium break-words text-ink">
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  danger,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  confirmDisabled?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-11 flex-1 rounded-xl border border-line text-[14px] font-medium text-ink transition hover:bg-surface"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className={[
          'h-11 flex-1 rounded-xl text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50',
          danger
            ? 'bg-red-700 hover:bg-red-800'
            : 'bg-brand-800 hover:bg-brand-900',
        ].join(' ')}
      >
        {confirmLabel}
      </button>
    </div>
  )
}

type AreaProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  requiredMark?: boolean
  error?: string
  rows?: number
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  requiredMark,
  error,
  rows = 3,
}: AreaProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
        {requiredMark ? <span className="ml-0.5 text-brand-600">*</span> : null}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={[
          'w-full resize-none rounded-xl border bg-panel px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/55',
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
            : 'border-line focus:border-brand-600 focus:ring-2 focus:ring-brand-100',
        ].join(' ')}
      />
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
