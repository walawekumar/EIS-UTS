import type { ReactNode } from 'react'

type PageSectionProps = {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Hilangkan padding luar (mis. isi penuh seperti peta). */
  flush?: boolean
}

/** Panel standar E-Gabah — dipakai lintas modul agar Absensi/HR sama dengan keuangan. */
export function PageSection({
  title,
  subtitle,
  actions,
  children,
  className,
  flush = false,
}: PageSectionProps) {
  const hasHeader = Boolean(title || subtitle || actions)
  return (
    <section
      className={[
        'rounded-2xl border border-line bg-panel',
        flush ? 'overflow-hidden' : 'p-4 sm:p-5',
        className ?? '',
      ].join(' ')}
    >
      {hasHeader ? (
        <div
          className={[
            'flex flex-wrap items-start justify-between gap-2',
            flush ? 'border-b border-line px-4 py-3.5 sm:px-5' : 'mb-3',
          ].join(' ')}
        >
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
