import type { ApprovalStamp } from '@/features/workflow/approvals'
import type { ProofAttachment } from '@/features/workflow/proof'

export type PayrollStatus =
  | 'draft'
  | 'menunggu_approve'
  | 'siap_cair'
  | 'posted'
  | 'void'

export type PayrollLine = {
  userId: string
  name: string
  role: string
  base: number
  allowance: number
  deduction: number
  note: string
}

export type PayrollRun = {
  id: string
  period: string // YYYY-MM
  status: PayrollStatus
  createdAt: string
  postedAt?: string
  voidedAt?: string
  actor: string
  lines: PayrollLine[]
  note: string
  approvals: ApprovalStamp[]
  transferProof?: ProofAttachment | string
  mutationNote?: string
  rejectReason?: string
}

export const PAYROLL_STATUS_LABEL: Record<PayrollStatus, string> = {
  draft: 'Draft',
  menunggu_approve: 'Menunggu approve',
  siap_cair: 'Siap cair',
  posted: 'Posted',
  void: 'Void',
}

export function migratePayrollStatus(raw: string): PayrollStatus {
  if (raw === 'posted' || raw === 'void' || raw === 'draft') return raw as PayrollStatus
  if (raw === 'menunggu_approve' || raw === 'siap_cair') return raw
  return 'draft'
}

export function normalizePayrollRun(raw: PayrollRun): PayrollRun {
  const status = migratePayrollStatus(String(raw.status))
  let approvals = raw.approvals ?? []
  if ((status === 'posted' || status === 'void') && approvals.length === 0) {
    const at = raw.postedAt ?? raw.voidedAt ?? raw.createdAt
    approvals = [
      { role: 'admin', by: raw.actor, at },
      { role: 'keuangan', by: 'Petugas Keuangan', at },
    ]
  }
  return {
    ...raw,
    status,
    approvals,
  }
}

export function lineNet(line: PayrollLine): number {
  return Math.max(0, line.base + line.allowance - line.deduction)
}

export function runTotal(run: PayrollRun): number {
  return run.lines.reduce((s, l) => s + lineNet(l), 0)
}

export function nextPayrollId(list: PayrollRun[], period: string): string {
  const prefix = `PR-${period.replace('-', '')}-`
  const max = list
    .filter((r) => r.id.startsWith(prefix))
    .reduce((m, r) => {
      const n = Number(r.id.slice(prefix.length))
      return Number.isFinite(n) ? Math.max(m, n) : m
    }, 0)
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export const ROLE_BASE_SALARY: Record<string, number> = {
  admin: 8_000_000,
  pembelian: 4_500_000,
  produksi: 4_200_000,
  gudang: 4_000_000,
  penjualan: 4_500_000,
  keuangan: 5_000_000,
}

export const SEED_PAYROLL: PayrollRun[] = [
  normalizePayrollRun({
    id: 'PR-202610-01',
    period: '2026-10',
    status: 'posted',
    createdAt: '2026-10-28T08:00:00.000Z',
    postedAt: '2026-10-28T09:00:00.000Z',
    actor: 'Admin E-Gabah',
    note: 'Gaji Oktober demo',
    approvals: [],
    lines: [
      {
        userId: 'USR-ADMIN',
        name: 'Admin E-Gabah',
        role: 'admin',
        base: 8_000_000,
        allowance: 500_000,
        deduction: 200_000,
        note: 'Tunjangan jabatan',
      },
      {
        userId: 'USR-PRODUKSI',
        name: 'Operator Produksi',
        role: 'produksi',
        base: 4_200_000,
        allowance: 300_000,
        deduction: 100_000,
        note: '',
      },
      {
        userId: 'USR-KEUANGAN',
        name: 'Petugas Keuangan',
        role: 'keuangan',
        base: 5_000_000,
        allowance: 250_000,
        deduction: 150_000,
        note: '',
      },
    ],
  }),
]
