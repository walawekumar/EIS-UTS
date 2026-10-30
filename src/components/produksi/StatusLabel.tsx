import { StatusPill } from '@/components/keuangan/StatusPill'
import {
  BATCH_STAGE_LABEL,
  type BatchStage,
} from '@/features/produksi/produksi-data'

const TONE: Record<
  BatchStage,
  'neutral' | 'good' | 'warn' | 'danger' | 'muted'
> = {
  draft: 'muted',
  submitted: 'warn',
  approved: 'neutral',
  processing: 'warn',
  done: 'good',
  rejected: 'danger',
  void: 'muted',
}

export function StageLabel({ stage }: { stage: BatchStage }) {
  return <StatusPill label={BATCH_STAGE_LABEL[stage]} tone={TONE[stage]} />
}
