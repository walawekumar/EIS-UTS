// src/features/workflow/proof.ts
export type ProofAttachment = {
  name: string
  size?: number
  mime?: string
  previewUrl?: string
}

export function hasProof(
  proof: ProofAttachment | string | null | undefined,
): boolean {
  if (!proof) return false
  if (typeof proof === 'string') return proof.trim().length > 0
  return proof.name.trim().length > 0
}
