export type ReturnStage =
  | 'draft'
  | 'diajukan'
  | 'disetujui'
  | 'posted'
  | 'ditolak'

export const RETURN_STAGE_LABEL: Record<ReturnStage, string> = {
  draft: 'Draft',
  diajukan: 'Diajukan',
  disetujui: 'Disetujui',
  posted: 'Posted',
  ditolak: 'Ditolak',
}

export function migrateReturnStage(raw: string): ReturnStage {
  if (raw in RETURN_STAGE_LABEL) return raw as ReturnStage
  return 'draft'
}
