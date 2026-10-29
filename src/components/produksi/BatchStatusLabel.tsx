import { BATCH_STATUS_LABEL, needsReview, type Batch, type BatchStatus } from '@/features/produksi/produksi-data'

type DisplayStatus = BatchStatus | 'tinjau'

const LABEL: Record<DisplayStatus, string> = { ...BATCH_STATUS_LABEL, tinjau: 'Perlu ditinjau' }

const TONE: Record<DisplayStatus, { pill: string; dot: string }> = {
  rencana: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  proses: { pill: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500 animate-pulse' },
  selesai: { pill: 'bg-brand-50 text-brand-800', dot: 'bg-brand-600' },
  tinjau: { pill: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
}

export function displayStatus(b: Batch): DisplayStatus {
  return needsReview(b) ? 'tinjau' : b.status
}

/** Satu label per batch; batch selesai yang bermasalah tampil sebagai "Perlu ditinjau". */
export function BatchStatusLabel({ batch }: { batch: Batch }) {
  const status = displayStatus(batch)
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap',
        TONE[status].pill,
      ].join(' ')}
    >
      <span className={['size-1.5 shrink-0 rounded-full', TONE[status].dot].join(' ')} aria-hidden />
      {LABEL[status]}
    </span>
  )
}
