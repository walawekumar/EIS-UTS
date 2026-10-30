import type {
  BankLine,
  BankLineStatus,
  BankSession,
  BankSnapshot,
} from '@/features/keuangan/bank-data'
import { getRelationalCache } from '@/lib/cloud-relational'
import { optNum, optStr, reqNum, reqStr } from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

function parseSessionStatus(raw: unknown): BankSession['status'] {
  if (raw === 'open' || raw === 'closed') return raw
  return 'open'
}

function parseLineStatus(raw: unknown): BankLineStatus {
  if (
    raw === 'unmatched' ||
    raw === 'matched' ||
    raw === 'ignored' ||
    raw === 'adjusted'
  ) {
    return raw
  }
  return 'unmatched'
}

function sessionFromRow(row: Record<string, unknown>): BankSession {
  const session: BankSession = {
    id: reqStr(row.id),
    startDate: reqStr(row.start_date),
    endDate: reqStr(row.end_date),
    cashAccountId: reqStr(row.cash_account_id),
    status: parseSessionStatus(row.status),
    createdAt: reqStr(row.created_at_label),
    createdBy: reqStr(row.created_by),
  }
  const statementBalance = optNum(row.statement_balance)
  if (statementBalance != null) session.statementBalance = statementBalance
  return session
}

function lineFromRow(row: Record<string, unknown>): BankLine {
  const line: BankLine = {
    id: reqStr(row.id),
    sessionId: reqStr(row.session_id),
    date: reqStr(row.date),
    memo: reqStr(row.memo),
    amount: reqNum(row.amount),
    status: parseLineStatus(row.status),
  }
  const bankRef = optStr(row.bank_ref)
  if (bankRef) line.bankRef = bankRef
  const cashEntryId = optStr(row.cash_entry_id)
  if (cashEntryId) line.cashEntryId = cashEntryId
  const journalSourceKey = optStr(row.journal_source_key)
  if (journalSourceKey) line.journalSourceKey = journalSourceKey
  const suggested = optStr(row.suggested_cash_entry_id)
  if (suggested) line.suggestedCashEntryId = suggested
  return line
}

function sessionToRow(session: BankSession): Record<string, unknown> {
  return {
    id: session.id,
    start_date: session.startDate,
    end_date: session.endDate,
    cash_account_id: session.cashAccountId,
    statement_balance: session.statementBalance ?? null,
    status: session.status,
    created_at_label: session.createdAt,
    created_by: session.createdBy,
  }
}

function lineToRow(line: BankLine): Record<string, unknown> {
  return {
    id: line.id,
    session_id: line.sessionId,
    date: line.date,
    memo: line.memo,
    amount: line.amount,
    bank_ref: line.bankRef ?? null,
    status: line.status,
    cash_entry_id: line.cashEntryId ?? null,
    journal_source_key: line.journalSourceKey ?? null,
    suggested_cash_entry_id: line.suggestedCashEntryId ?? null,
  }
}

export function assembleBank(base: BankSnapshot): BankSnapshot | null {
  const sessions = getRelationalCache('bank_sessions')
  const lines = getRelationalCache('bank_lines')
  if (!sessions || !lines) return null

  return {
    ...base,
    sessions: sessions.map(sessionFromRow),
    lines: lines.map(lineFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectBank(
  snap: BankSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  return {
    bank_sessions: snap.sessions.map(sessionToRow),
    bank_lines: snap.lines.map(lineToRow),
  }
}
