/** Ops succeeded; optional auto-journal failure for page toast (dual-track). */
export type DualTrackResult =
  | { ok: false; error: string }
  | { ok: true; journalError?: string }

export function joinJournalErrors(
  ...errors: (string | undefined)[]
): string | undefined {
  const parts = errors.filter((e): e is string => Boolean(e))
  if (parts.length === 0) return undefined
  return parts.join('; ')
}
