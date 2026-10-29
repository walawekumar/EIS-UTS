type Tone = 'neutral' | 'good' | 'warn' | 'danger' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  good: 'bg-brand-100 text-brand-800',
  warn: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  muted: 'bg-surface text-muted',
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: Tone
}) {
  return (
    <span
      className={[
        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        TONE_CLASS[tone],
      ].join(' ')}
    >
      {label}
    </span>
  )
}
