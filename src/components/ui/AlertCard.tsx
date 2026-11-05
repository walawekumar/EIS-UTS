import type { ReactNode } from 'react'

type AlertCardProps = {
  tone?: 'success' | 'danger' | 'info'
  children: ReactNode
}

const TONE = {
  success: 'border-brand-200 bg-brand-50 text-brand-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-line bg-surface text-ink',
}

/** Kartu umpan balik — sukses, gagal, atau informasi. */
export function AlertCard({ tone = 'info', children }: AlertCardProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={[
        'motion-rise rounded-2xl border px-3.5 py-2.5 text-[13px] leading-relaxed',
        TONE[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}
