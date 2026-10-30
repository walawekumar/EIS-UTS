import {
  migratePayrollStatus,
  type PayrollLine,
  type PayrollRun,
} from '@/features/payroll/payroll-data'
import type { PayrollSnapshot } from '@/features/payroll/payroll-storage'
import type { ProofAttachment } from '@/features/workflow/proof'
import { getRelationalCache } from '@/lib/cloud-relational'
import {
  approvalsFromJson,
  approvalsToJson,
  compareChildId,
  optNum,
  optStr,
  projectChildId,
  reqNum,
  reqStr,
  rowsByParent,
} from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

function proofFromJson(raw: unknown): ProofAttachment | string | undefined {
  if (typeof raw === 'string') return raw === '' ? undefined : raw
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name : ''
  const size = optNum(o.size)
  const mime = optStr(o.mime)
  const previewUrl = optStr(o.previewUrl)
  if (!name && size == null && !mime && !previewUrl) return undefined
  const proof: ProofAttachment = { name }
  if (size != null) proof.size = size
  if (mime) proof.mime = mime
  if (previewUrl) proof.previewUrl = previewUrl
  return proof
}

function proofToJson(
  proof: ProofAttachment | string | undefined,
): ProofAttachment | string | null {
  if (proof == null) return null
  if (typeof proof === 'string') return proof === '' ? null : proof
  const out: ProofAttachment = { name: proof.name }
  if (proof.size != null && Number.isFinite(proof.size)) out.size = proof.size
  if (proof.mime) out.mime = proof.mime
  if (proof.previewUrl) out.previewUrl = proof.previewUrl
  return out
}

function lineFromRow(row: Record<string, unknown>): PayrollLine {
  return {
    userId: reqStr(row.user_id),
    name: reqStr(row.name),
    role: reqStr(row.role),
    base: reqNum(row.base),
    allowance: reqNum(row.allowance),
    deduction: reqNum(row.deduction),
    note: reqStr(row.note),
  }
}

function runFromRow(row: Record<string, unknown>, lines: PayrollLine[]): PayrollRun {
  const run: PayrollRun = {
    id: reqStr(row.id),
    period: reqStr(row.period),
    status: migratePayrollStatus(reqStr(row.status)),
    createdAt: reqStr(row.created_at_label),
    actor: reqStr(row.actor),
    lines,
    note: reqStr(row.note),
    approvals: approvalsFromJson(row.approvals) ?? [],
  }
  const postedAt = optStr(row.posted_at)
  if (postedAt) run.postedAt = postedAt
  const voidedAt = optStr(row.voided_at)
  if (voidedAt) run.voidedAt = voidedAt
  const transferProof = proofFromJson(row.transfer_proof)
  if (transferProof !== undefined) run.transferProof = transferProof
  const mutationNote = optStr(row.mutation_note)
  if (mutationNote) run.mutationNote = mutationNote
  return run
}

function runToRow(run: PayrollRun): Record<string, unknown> {
  return {
    id: run.id,
    period: run.period,
    status: run.status,
    created_at_label: run.createdAt,
    posted_at: run.postedAt ?? null,
    voided_at: run.voidedAt ?? null,
    actor: run.actor,
    note: run.note,
    approvals: approvalsToJson(run.approvals),
    transfer_proof: proofToJson(run.transferProof),
    mutation_note: run.mutationNote ?? null,
  }
}

function lineToRow(runId: string, line: PayrollLine, index: number): Record<string, unknown> {
  return {
    id: projectChildId(runId, undefined, index),
    run_id: runId,
    user_id: line.userId,
    name: line.name,
    role: line.role,
    base: line.base,
    allowance: line.allowance,
    deduction: line.deduction,
    note: line.note,
  }
}

export function assemblePayroll(base: PayrollSnapshot): PayrollSnapshot | null {
  const runs = getRelationalCache('payroll_runs')
  const lines = getRelationalCache('payroll_lines')
  if (!runs || !lines) return null

  const linesByRun = rowsByParent(lines, 'run_id')
  const runDocs = runs.map((row) => {
    const id = reqStr(row.id)
    const lineRows = (linesByRun.get(id) ?? [])
      .slice()
      .sort((a, b) => compareChildId(id, reqStr(a.id), reqStr(b.id)))
    return runFromRow(row, lineRows.map(lineFromRow))
  })

  return {
    ...base,
    runs: runDocs,
    updatedAt: new Date().toISOString(),
  }
}

export function projectPayroll(
  snap: PayrollSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  const runRows: Record<string, unknown>[] = []
  const lineRows: Record<string, unknown>[] = []
  for (const run of snap.runs) {
    runRows.push(runToRow(run))
    for (let i = 0; i < run.lines.length; i++) {
      lineRows.push(lineToRow(run.id, run.lines[i], i))
    }
  }

  return {
    payroll_runs: runRows,
    payroll_lines: lineRows,
  }
}
