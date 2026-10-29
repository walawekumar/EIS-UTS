import {
  PAYMENT_STATUS_LABEL,
  STAGE_LABEL,
  type PaymentStatus,
  type PurchaseStage,
} from '@/features/pembelian/pembelian-data'

const STAGE_TONE: Record<PurchaseStage, string> = {
  dicatat: 'bg-slate-100 text-slate-700',
  ditimbang: 'bg-amber-100 text-amber-800',
  diterima: 'bg-brand-100 text-brand-800',
}

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  lunas: 'bg-brand-100 text-brand-800',
  sebagian: 'bg-amber-100 text-amber-800',
  belum: 'bg-slate-100 text-slate-700',
  terlambat: 'bg-red-100 text-red-800',
}

const pill =
  'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap'

export function StageLabel({ stage }: { stage: PurchaseStage }) {
  return <span className={[pill, STAGE_TONE[stage]].join(' ')}>{STAGE_LABEL[stage]}</span>
}

export function PaymentLabel({ status }: { status: PaymentStatus }) {
  return <span className={[pill, PAYMENT_TONE[status]].join(' ')}>{PAYMENT_STATUS_LABEL[status]}</span>
}

export function GrainLabel({ grain }: { grain: string }) {
  return (
    <span className="inline-flex rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink">
      {grain}
    </span>
  )
}
