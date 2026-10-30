export type BankLineStatus = 'unmatched' | 'matched' | 'ignored' | 'adjusted'

export type BankSession = {
  id: string
  startDate: string
  endDate: string
  cashAccountId: string
  statementBalance?: number
  status: 'open' | 'closed'
  createdAt: string
  createdBy: string
}

export type BankLine = {
  id: string
  sessionId: string
  date: string
  memo: string
  amount: number
  bankRef?: string
  status: BankLineStatus
  cashEntryId?: string
  journalSourceKey?: string
  suggestedCashEntryId?: string
}

export type BankSnapshot = {
  version: 1
  sessions: BankSession[]
  lines: BankLine[]
  updatedAt: string
}

export const EMPTY_BANK_SNAPSHOT: BankSnapshot = {
  version: 1,
  sessions: [],
  lines: [],
  updatedAt: new Date().toISOString(),
}
