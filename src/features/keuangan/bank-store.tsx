import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BankLine, BankSession } from '@/features/keuangan/bank-data'
import { parseBankCsv } from '@/features/keuangan/bank-csv'
import { suggestMatches } from '@/features/keuangan/bank-match'
import { bankRepository } from '@/features/keuangan/bank-storage'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { assertPeriodOpen } from '@/features/keuangan/period-gate'
import type { JournalLine } from '@/features/keuangan/gl-data'

function nextSessionId(): string {
  return `bs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function nextLineId(): string {
  return `bl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function sessionSummary(lines: BankLine[]): {
  matched: number
  unmatched: number
  ignored: number
  adjusted: number
} {
  let matched = 0
  let unmatched = 0
  let ignored = 0
  let adjusted = 0
  for (const l of lines) {
    if (l.status === 'matched') matched++
    else if (l.status === 'ignored') ignored++
    else if (l.status === 'adjusted') adjusted++
    else unmatched++
  }
  return { matched, unmatched, ignored, adjusted }
}

type BankStoreValue = {
  sessions: BankSession[]
  lines: BankLine[]
  createSession: (input: {
    startDate: string
    endDate: string
    statementBalance?: number
    by: string
  }) => string | undefined
  importCsv: (sessionId: string, csvText: string) => string | undefined
  runAutoMatch: (sessionId: string) => void
  acceptSuggestion: (lineId: string) => string | undefined
  rejectSuggestion: (lineId: string) => void
  manualMatch: (lineId: string, cashEntryId: string) => string | undefined
  ignoreLine: (lineId: string) => void
  postAdjustment: (
    lineId: string,
    opts: { memo?: string },
  ) => string | undefined
}

const BankStoreContext = createContext<BankStoreValue | null>(null)

export function BankProvider({ children }: { children: ReactNode }) {
  const boot = bankRepository.load()
  const [sessions, setSessions] = useState<BankSession[]>(() => [
    ...boot.sessions,
  ])
  const [lines, setLines] = useState<BankLine[]>(() => [...boot.lines])
  const { cashEntries, postJournalEntry, mapAccount } = useFinanceStore()

  useEffect(() => {
    bankRepository.save({
      version: 1,
      sessions,
      lines,
      updatedAt: new Date().toISOString(),
    })
  }, [sessions, lines])

  const takenCashIdsForSession = useCallback(
    (sessionId: string): Set<string> => {
      const taken = new Set<string>()
      for (const l of lines) {
        if (l.sessionId !== sessionId) continue
        if (l.cashEntryId) taken.add(l.cashEntryId)
      }
      return taken
    },
    [lines],
  )

  const createSession = useCallback(
    (input: {
      startDate: string
      endDate: string
      statementBalance?: number
      by: string
    }): string | undefined => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
      ) {
        return 'Tanggal sesi harus YYYY-MM-DD.'
      }
      if (input.startDate > input.endDate) {
        return 'Tanggal mulai harus sebelum tanggal akhir.'
      }
      const session: BankSession = {
        id: nextSessionId(),
        startDate: input.startDate,
        endDate: input.endDate,
        cashAccountId: mapAccount('cash'),
        statementBalance: input.statementBalance,
        status: 'open',
        createdAt: new Date().toISOString(),
        createdBy: input.by,
      }
      setSessions((list) => [session, ...list])
      return undefined
    },
    [mapAccount],
  )

  const importCsv = useCallback(
    (sessionId: string, csvText: string): string | undefined => {
      const session = sessions.find((s) => s.id === sessionId)
      if (!session) return 'Sesi rekon tidak ditemukan.'
      const parsed = parseBankCsv(csvText)
      if (parsed.error) return parsed.error
      const newLines: BankLine[] = parsed.lines.map((draft) => ({
        ...draft,
        id: nextLineId(),
        sessionId,
        status: 'unmatched',
      }))
      setLines((list) => [...newLines, ...list])
      return undefined
    },
    [sessions],
  )

  const runAutoMatch = useCallback(
    (sessionId: string) => {
      const taken = takenCashIdsForSession(sessionId)
      const unmatched = lines.filter(
        (l) => l.sessionId === sessionId && l.status === 'unmatched',
      )
      const suggestions = suggestMatches(unmatched, cashEntries, taken)
      setLines((list) =>
        list.map((l) => {
          if (l.sessionId !== sessionId || l.status !== 'unmatched') return l
          const sug = suggestions.get(l.id)
          if (!sug) {
            return { ...l, suggestedCashEntryId: undefined }
          }
          return { ...l, suggestedCashEntryId: sug }
        }),
      )
    },
    [lines, cashEntries, takenCashIdsForSession],
  )

  const acceptSuggestion = useCallback(
    (lineId: string): string | undefined => {
      const line = lines.find((l) => l.id === lineId)
      if (!line) return 'Baris bank tidak ditemukan.'
      if (line.status !== 'unmatched') return 'Baris sudah diproses.'
      if (!line.suggestedCashEntryId) return 'Tidak ada saran match.'
      const taken = takenCashIdsForSession(line.sessionId)
      if (taken.has(line.suggestedCashEntryId)) {
        return 'Entri kas sudah dipakai di sesi ini.'
      }
      setLines((list) =>
        list.map((l) =>
          l.id === lineId
            ? {
                ...l,
                status: 'matched' as const,
                cashEntryId: line.suggestedCashEntryId,
                suggestedCashEntryId: undefined,
              }
            : l,
        ),
      )
      return undefined
    },
    [lines, takenCashIdsForSession],
  )

  const rejectSuggestion = useCallback((lineId: string) => {
    setLines((list) =>
      list.map((l) =>
        l.id === lineId ? { ...l, suggestedCashEntryId: undefined } : l,
      ),
    )
  }, [])

  const manualMatch = useCallback(
    (lineId: string, cashEntryId: string): string | undefined => {
      const line = lines.find((l) => l.id === lineId)
      if (!line) return 'Baris bank tidak ditemukan.'
      if (line.status !== 'unmatched') return 'Baris sudah diproses.'
      const entry = cashEntries.find((c) => c.id === cashEntryId)
      if (!entry) return 'Entri kas tidak ditemukan.'
      const taken = takenCashIdsForSession(line.sessionId)
      if (taken.has(cashEntryId)) {
        return 'Entri kas sudah dipakai di sesi ini.'
      }
      setLines((list) =>
        list.map((l) =>
          l.id === lineId
            ? {
                ...l,
                status: 'matched' as const,
                cashEntryId,
                suggestedCashEntryId: undefined,
              }
            : l,
        ),
      )
      return undefined
    },
    [lines, cashEntries, takenCashIdsForSession],
  )

  const ignoreLine = useCallback((lineId: string) => {
    setLines((list) =>
      list.map((l) =>
        l.id === lineId && l.status === 'unmatched'
          ? {
              ...l,
              status: 'ignored' as const,
              suggestedCashEntryId: undefined,
            }
          : l,
      ),
    )
  }, [])

  const postAdjustment = useCallback(
    (
      lineId: string,
      opts: { memo?: string },
    ): string | undefined => {
      const line = lines.find((l) => l.id === lineId)
      if (!line) return 'Baris bank tidak ditemukan.'
      if (line.status !== 'unmatched') {
        return 'Penyesuaian hanya untuk baris unmatched.'
      }
      const locked = assertPeriodOpen(line.date)
      if (locked) return locked

      const sessionId = line.sessionId
      const sourceKey = `bank:${sessionId}:adj:${lineId}`
      const cashId = mapAccount('cash')
      const suspenseId = mapAccount('bankSuspense')
      const abs = Math.abs(line.amount)
      const memo =
        opts.memo?.trim() ||
        `Rekon bank: ${line.memo}`.slice(0, 120)

      let journalLines: JournalLine[]
      if (line.amount > 0) {
        journalLines = [
          { accountId: cashId, debit: abs, credit: 0, memo },
          { accountId: suspenseId, debit: 0, credit: abs, memo },
        ]
      } else {
        journalLines = [
          { accountId: suspenseId, debit: abs, credit: 0, memo },
          { accountId: cashId, debit: 0, credit: abs, memo },
        ]
      }

      const jeErr = postJournalEntry({
        date: line.date,
        memo,
        sourceKey,
        sourceType: 'auto',
        manual: false,
        lines: journalLines,
      })
      if (jeErr) return jeErr

      setLines((list) =>
        list.map((l) =>
          l.id === lineId
            ? {
                ...l,
                status: 'adjusted' as const,
                journalSourceKey: sourceKey,
                suggestedCashEntryId: undefined,
              }
            : l,
        ),
      )
      return undefined
    },
    [lines, mapAccount, postJournalEntry],
  )

  const value = useMemo(
    (): BankStoreValue => ({
      sessions,
      lines,
      createSession,
      importCsv,
      runAutoMatch,
      acceptSuggestion,
      rejectSuggestion,
      manualMatch,
      ignoreLine,
      postAdjustment,
    }),
    [
      sessions,
      lines,
      createSession,
      importCsv,
      runAutoMatch,
      acceptSuggestion,
      rejectSuggestion,
      manualMatch,
      ignoreLine,
      postAdjustment,
    ],
  )

  return (
    <BankStoreContext.Provider value={value}>
      {children}
    </BankStoreContext.Provider>
  )
}

export function useBankStore(): BankStoreValue {
  const ctx = useContext(BankStoreContext)
  if (!ctx) {
    throw new Error('useBankStore must be used within BankProvider')
  }
  return ctx
}
