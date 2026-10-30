// src/features/keuangan/gl-journal.ts
import {
  nextJournalId,
  type Account,
  type FailedJournalPost,
  type JournalEntry,
  type JournalLine,
  type JournalSourceType,
} from '@/features/keuangan/gl-data'

export type PostJournalInput = {
  date: string
  memo: string
  sourceKey?: string
  sourceType: JournalSourceType
  manual: boolean
  lines: JournalLine[]
  createdBy: string
  accounts: Account[]
  journals: JournalEntry[]
}

export type PostJournalResult =
  | { ok: true; entry: JournalEntry; journals: JournalEntry[] }
  | { ok: false; error: string }

function linesBalance(lines: JournalLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0)
  const c = lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(d - c) < 0.005 && d > 0
}

export function postJournal(input: PostJournalInput): PostJournalResult {
  if (input.sourceKey) {
    const existing = input.journals.find(
      (j) => j.sourceKey === input.sourceKey && !j.voidedAt,
    )
    if (existing) return { ok: true, entry: existing, journals: input.journals }
  }
  if (!input.lines.length) return { ok: false, error: 'Jurnal tanpa baris.' }
  if (!linesBalance(input.lines)) {
    return { ok: false, error: 'Debit dan kredit tidak balance.' }
  }
  for (const line of input.lines) {
    if (line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0)) {
      return { ok: false, error: 'Baris jurnal tidak valid.' }
    }
    const acc = input.accounts.find((a) => a.id === line.accountId)
    if (!acc || !acc.active || !acc.isPostable) {
      return { ok: false, error: `Akun tidak dapat diposting: ${line.accountId}` }
    }
  }
  const entry: JournalEntry = {
    id: nextJournalId(input.journals),
    date: input.date,
    memo: input.memo,
    sourceKey: input.sourceKey,
    sourceType: input.sourceType,
    manual: input.manual,
    lines: input.lines,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  return { ok: true, entry, journals: [entry, ...input.journals] }
}

function findReverseTarget(
  journals: JournalEntry[],
  opts: { sourceKey?: string; id?: string },
): JournalEntry | undefined {
  if (opts.id) return journals.find((j) => j.id === opts.id)
  if (!opts.sourceKey) return undefined
  const live = journals.find(
    (j) => j.sourceKey === opts.sourceKey && !j.voidedAt,
  )
  if (live) return live
  return journals.find(
    (j) =>
      j.sourceKey === opts.sourceKey && j.voidedAt && j.reversedById,
  )
}

export function reverseJournal(
  journals: JournalEntry[],
  opts: { sourceKey?: string; id?: string; createdBy: string; date: string },
): PostJournalResult {
  const target = findReverseTarget(journals, opts)
  if (!target) return { ok: false, error: 'Jurnal tidak ditemukan.' }
  if (target.reversedById) {
    const rev = journals.find((j) => j.id === target.reversedById)
    if (rev) return { ok: true, entry: rev, journals }
  }
  const lines = target.lines.map((l) => ({
    accountId: l.accountId,
    debit: l.credit,
    credit: l.debit,
    memo: l.memo,
  }))
  const revId = nextJournalId(journals)
  const voidedAt = new Date().toISOString()
  const reverseEntry: JournalEntry = {
    id: revId,
    date: opts.date,
    memo: `Reverse ${target.id}: ${target.memo}`,
    sourceKey: target.sourceKey ? `${target.sourceKey}:void` : undefined,
    sourceType: 'reverse',
    manual: false,
    lines,
    createdBy: opts.createdBy,
    createdAt: voidedAt,
    reversesId: target.id,
  }
  const updated = journals.map((j) =>
    j.id === target.id
      ? { ...j, reversedById: revId, voidedAt }
      : j,
  )
  return { ok: true, entry: reverseEntry, journals: [reverseEntry, ...updated] }
}

export function enqueueFailedPost(
  list: FailedJournalPost[],
  item: FailedJournalPost,
): FailedJournalPost[] {
  return [item, ...list.filter((f) => f.sourceKey !== item.sourceKey)]
}

export function removeFailedPost(
  list: FailedJournalPost[],
  sourceKey: string,
): FailedJournalPost[] {
  return list.filter((f) => f.sourceKey !== sourceKey)
}
