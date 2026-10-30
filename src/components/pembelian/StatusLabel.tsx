import {
  PAYMENT_STATUS_LABEL,
  STAGE_LABEL,
  type PaymentStatus,
  type PurchaseStage,
} from '@/features/pembelian/pembelian-data'

const STAGE_TONE: Record<PurchaseStage, { wrap: string; dot: string }> = {
  draft: { wrap: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  diajukan: { wrap: 'bg-sky-50 text-sky-800', dot: 'bg-sky-500' },
  disetujui: { wrap: 'bg-indigo-50 text-indigo-800', dot: 'bg-indigo-500' },
  ditolak: { wrap: 'bg-red-50 text-red-800', dot: 'bg-red-500' },
  ditimbang: { wrap: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  menunggu_selesai: { wrap: 'bg-violet-50 text-violet-800', dot: 'bg-violet-500' },
  selesai: { wrap: 'bg-brand-50 text-brand-800', dot: 'bg-brand-600' },
}

const PAYMENT_TONE: Record<PaymentStatus, { wrap: string; dot: string }> = {
  lunas: { wrap: 'bg-brand-50 text-brand-800', dot: 'bg-brand-600' },
  sebagian: { wrap: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  belum: { wrap: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  terlambat: { wrap: 'bg-red-50 text-red-800', dot: 'bg-red-500' },
}

const pill =
  'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap'

export function StageLabel({ stage }: { stage: PurchaseStage }) {
  const tone = STAGE_TONE[stage]
  return (
    <span className={[pill, tone.wrap].join(' ')}>
      <span className={['size-1.5 rounded-full', tone.dot].join(' ')} aria-hidden />
      {STAGE_LABEL[stage]}
    </span>
  )
}

export function PaymentLabel({ status }: { status: PaymentStatus }) {
  const tone = PAYMENT_TONE[status]
  return (
    <span className={[pill, tone.wrap].join(' ')}>
      <span className={['size-1.5 rounded-full', tone.dot].join(' ')} aria-hidden />
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  )
}

export function GrainLabel({ grain }: { grain: string }) {
  return (
    <span className="inline-flex rounded-lg border border-line/80 bg-white px-2 py-1 font-mono text-[11px] text-ink">
      {grain}
    </span>
  )
}
