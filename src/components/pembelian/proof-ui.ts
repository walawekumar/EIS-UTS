import type { ReceiptValue } from '@/components/keuangan/ReceiptUpload'
import type { ProofAttachment } from '@/features/workflow/proof'

export function receiptToProof(receipt: ReceiptValue): ProofAttachment | undefined {
  if (!receipt) return undefined
  return {
    name: receipt.name,
    size: receipt.size,
    mime: receipt.mime,
    previewUrl: receipt.previewUrl,
  }
}

export function proofToReceipt(
  proof: ProofAttachment | string | undefined,
): ReceiptValue {
  if (!proof) return null
  if (typeof proof === 'string') {
    return {
      name: proof,
      size: 0,
      previewUrl: '',
      mime: 'application/octet-stream',
    }
  }
  return {
    name: proof.name,
    size: proof.size ?? 0,
    previewUrl: proof.previewUrl ?? '',
    mime: proof.mime ?? 'image/jpeg',
  }
}

export function proofLabel(proof: ProofAttachment | string | undefined): string | null {
  if (!proof) return null
  return typeof proof === 'string' ? proof : proof.name
}
