import type {
  CashDirection,
  CashEntry,
  ExpenseRow,
  ExpenseStatus,
  PayableRow,
  PayableStatus,
  ReceivableRow,
  ReceivableStatus,
} from '@/features/keuangan/keuangan-data'
import type { KeuanganSnapshot } from '@/features/keuangan/keuangan-storage'
import { getRelationalCache } from '@/lib/cloud-relational'
import {
  optStr,
  reqNum,
  reqStr,
  taxFromJson,
  taxToJson,
} from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

function parseDirection(raw: unknown): CashDirection {
  if (raw === 'in' || raw === 'out') return raw
  return 'in'
}

function parsePartyStatus(raw: unknown): PayableStatus {
  if (raw === 'open' || raw === 'partial' || raw === 'overdue' || raw === 'paid') return raw
  return 'open'
}

function parseReceivableStatus(raw: unknown): ReceivableStatus {
  if (raw === 'open' || raw === 'partial' || raw === 'overdue' || raw === 'paid') return raw
  return 'open'
}

function parseExpenseStatus(raw: unknown): ExpenseStatus {
  if (raw === 'draft' || raw === 'posted' || raw === 'void') return raw
  return 'draft'
}

function cashFromRow(row: Record<string, unknown>): CashEntry {
  const entry: CashEntry = {
    id: reqStr(row.id),
    date: reqStr(row.date),
    reference: reqStr(row.reference),
    description: reqStr(row.description),
    category: reqStr(row.category),
    direction: parseDirection(row.direction),
    amount: reqNum(row.amount),
    balance: reqNum(row.balance),
    actor: reqStr(row.actor),
  }
  const receiptName = optStr(row.receipt_name)
  if (receiptName) entry.receiptName = receiptName
  return entry
}

function payableFromRow(row: Record<string, unknown>): PayableRow {
  const payable: PayableRow = {
    id: reqStr(row.id),
    supplier: reqStr(row.supplier),
    invoice: reqStr(row.invoice),
    dueDate: reqStr(row.due_date),
    amount: reqNum(row.amount),
    paid: reqNum(row.paid),
    status: parsePartyStatus(row.status),
    agingDays: reqNum(row.aging_days),
  }
  const receiptName = optStr(row.receipt_name)
  if (receiptName) payable.receiptName = receiptName
  return payable
}

function receivableFromRow(row: Record<string, unknown>): ReceivableRow {
  const receivable: ReceivableRow = {
    id: reqStr(row.id),
    customer: reqStr(row.customer),
    invoice: reqStr(row.invoice),
    dueDate: reqStr(row.due_date),
    amount: reqNum(row.amount),
    paid: reqNum(row.paid),
    status: parseReceivableStatus(row.status),
    agingDays: reqNum(row.aging_days),
  }
  const receiptName = optStr(row.receipt_name)
  if (receiptName) receivable.receiptName = receiptName
  return receivable
}

function expenseFromRow(row: Record<string, unknown>): ExpenseRow {
  const expense: ExpenseRow = {
    id: reqStr(row.id),
    date: reqStr(row.date),
    reference: reqStr(row.reference),
    category: reqStr(row.category),
    description: reqStr(row.description),
    amount: reqNum(row.amount),
    status: parseExpenseStatus(row.status),
    actor: reqStr(row.actor),
    ...taxFromJson(row.tax),
  }
  const receiptName = optStr(row.receipt_name)
  if (receiptName) expense.receiptName = receiptName
  return expense
}

function cashToRow(entry: CashEntry): Record<string, unknown> {
  return {
    id: entry.id,
    date: entry.date,
    reference: entry.reference,
    description: entry.description,
    category: entry.category,
    direction: entry.direction,
    amount: entry.amount,
    balance: entry.balance,
    actor: entry.actor,
    receipt_name: entry.receiptName ?? null,
  }
}

function payableToRow(row: PayableRow): Record<string, unknown> {
  return {
    id: row.id,
    supplier: row.supplier,
    invoice: row.invoice,
    due_date: row.dueDate,
    amount: row.amount,
    paid: row.paid,
    status: row.status,
    aging_days: row.agingDays,
    receipt_name: row.receiptName ?? null,
  }
}

function receivableToRow(row: ReceivableRow): Record<string, unknown> {
  return {
    id: row.id,
    customer: row.customer,
    invoice: row.invoice,
    due_date: row.dueDate,
    amount: row.amount,
    paid: row.paid,
    status: row.status,
    aging_days: row.agingDays,
    receipt_name: row.receiptName ?? null,
  }
}

function expenseToRow(row: ExpenseRow): Record<string, unknown> {
  return {
    id: row.id,
    date: row.date,
    reference: row.reference,
    category: row.category,
    description: row.description,
    amount: row.amount,
    status: row.status,
    actor: row.actor,
    receipt_name: row.receiptName ?? null,
    tax: taxToJson(row),
  }
}

export function assembleKeuangan(base: KeuanganSnapshot): KeuanganSnapshot | null {
  const cash = getRelationalCache('cash_entries')
  const payables = getRelationalCache('payables')
  const receivables = getRelationalCache('receivables')
  const expenses = getRelationalCache('expenses')
  if (!cash || !payables || !receivables || !expenses) return null

  return {
    ...base,
    cashEntries: cash.map(cashFromRow),
    payables: payables.map(payableFromRow),
    receivables: receivables.map(receivableFromRow),
    expenses: expenses.map(expenseFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectKeuangan(
  snap: KeuanganSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  return {
    cash_entries: snap.cashEntries.map(cashToRow),
    payables: snap.payables.map(payableToRow),
    receivables: snap.receivables.map(receivableToRow),
    expenses: snap.expenses.map(expenseToRow),
  }
}
