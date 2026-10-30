// src/features/workflow/approvals.ts

export type ApprovalStamp = {
  role: 'admin' | 'keuangan' | 'pembelian' | 'penjualan' | 'produksi' | 'gudang'
  by: string
  at: string
  note?: string
}

export function hasApproval(
  list: ApprovalStamp[] | undefined,
  role: ApprovalStamp['role'],
): boolean {
  return Boolean(list?.some((a) => a.role === role))
}

export function upsertApproval(
  list: ApprovalStamp[] | undefined,
  stamp: ApprovalStamp,
): ApprovalStamp[] {
  const prev = list ?? []
  return [...prev.filter((a) => a.role !== stamp.role), stamp]
}

export function clearApprovals(): ApprovalStamp[] {
  return []
}
