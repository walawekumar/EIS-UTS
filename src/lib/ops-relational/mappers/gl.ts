import {
  DEFAULT_ACCOUNT_MAP,
  type Account,
  type AccountMap,
  type AccountMapKey,
  type AccountType,
  type FailedJournalPost,
  type GlSnapshot,
  type JournalEntry,
  type JournalLine,
  type JournalSourceType,
} from '@/features/keuangan/gl-data'
import { getRelationalCache } from '@/lib/cloud-relational'
import {
  compareChildId,
  optStr,
  projectChildId,
  reqBool,
  reqNum,
  reqStr,
  rowsByParent,
} from '@/lib/ops-relational/mappers/shared'
import type { OpsTableName } from '@/lib/ops-relational/types'

const MAP_ID = 'map'

function parseAccountType(raw: unknown): AccountType {
  if (
    raw === 'asset' ||
    raw === 'liability' ||
    raw === 'equity' ||
    raw === 'revenue' ||
    raw === 'expense'
  ) {
    return raw
  }
  return 'asset'
}

function parseSourceType(raw: unknown): JournalSourceType {
  if (raw === 'auto' || raw === 'manual' || raw === 'opening' || raw === 'reverse') return raw
  return 'auto'
}

function accountFromRow(row: Record<string, unknown>): Account {
  const account: Account = {
    id: reqStr(row.id),
    code: reqStr(row.code),
    name: reqStr(row.name),
    type: parseAccountType(row.type),
    isPostable: reqBool(row.is_postable),
    active: reqBool(row.active),
    system: reqBool(row.system),
  }
  const parentId = optStr(row.parent_id)
  if (parentId) account.parentId = parentId
  return account
}

function accountMapFromJson(raw: unknown): AccountMap {
  const map: AccountMap = { ...DEFAULT_ACCOUNT_MAP }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map
  const value = raw as Record<string, unknown>
  for (const key of Object.keys(DEFAULT_ACCOUNT_MAP) as AccountMapKey[]) {
    const accountId = value[key]
    if (typeof accountId === 'string' && accountId !== '') map[key] = accountId
  }
  return map
}

function accountMapFromRows(rows: Record<string, unknown>[]): AccountMap {
  const row = rows.find((item) => reqStr(item.id) === MAP_ID) ?? rows[0]
  if (!row) return { ...DEFAULT_ACCOUNT_MAP }
  return accountMapFromJson(row.value)
}

function journalLineFromRow(row: Record<string, unknown>): JournalLine {
  const line: JournalLine = {
    accountId: reqStr(row.account_id),
    debit: reqNum(row.debit),
    credit: reqNum(row.credit),
  }
  const memo = optStr(row.memo)
  if (memo) line.memo = memo
  return line
}

function journalLinesFromPayload(raw: unknown): JournalLine[] {
  if (!Array.isArray(raw)) return []
  const lines: JournalLine[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const line = item as Record<string, unknown>
    const next: JournalLine = {
      accountId: reqStr(line.accountId),
      debit: reqNum(line.debit),
      credit: reqNum(line.credit),
    }
    const memo = optStr(line.memo)
    if (memo) next.memo = memo
    lines.push(next)
  }
  return lines
}

function journalFromRow(row: Record<string, unknown>, lines: JournalLine[]): JournalEntry {
  const entry: JournalEntry = {
    id: reqStr(row.id),
    date: reqStr(row.date),
    memo: reqStr(row.memo),
    sourceType: parseSourceType(row.source_type),
    manual: reqBool(row.manual),
    lines,
    createdBy: reqStr(row.created_by),
    createdAt: reqStr(row.created_at_label),
  }
  const sourceKey = optStr(row.source_key)
  if (sourceKey) entry.sourceKey = sourceKey
  const voidedAt = optStr(row.voided_at)
  if (voidedAt) entry.voidedAt = voidedAt
  const reversesId = optStr(row.reverses_id)
  if (reversesId) entry.reversesId = reversesId
  const reversedById = optStr(row.reversed_by_id)
  if (reversedById) entry.reversedById = reversedById
  return entry
}

function payloadFromJson(raw: unknown): FailedJournalPost['payload'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      date: '',
      memo: '',
      sourceType: 'auto',
      manual: false,
      lines: [],
      createdBy: '',
    }
  }
  const payload = raw as Record<string, unknown>
  const next: FailedJournalPost['payload'] = {
    date: reqStr(payload.date),
    memo: reqStr(payload.memo),
    sourceType: parseSourceType(payload.sourceType),
    manual: reqBool(payload.manual),
    lines: journalLinesFromPayload(payload.lines),
    createdBy: reqStr(payload.createdBy),
  }
  const sourceKey = optStr(payload.sourceKey)
  if (sourceKey) next.sourceKey = sourceKey
  const reversesId = optStr(payload.reversesId)
  if (reversesId) next.reversesId = reversesId
  return next
}

function failedPostFromRow(row: Record<string, unknown>): FailedJournalPost {
  return {
    sourceKey: optStr(row.source_key) ?? optStr(row.id) ?? '',
    payload: payloadFromJson(row.payload),
    error: reqStr(row.error),
    createdAt: reqStr(row.created_at_label),
  }
}

function accountToRow(account: Account): Record<string, unknown> {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    parent_id: account.parentId ?? null,
    is_postable: account.isPostable,
    active: account.active,
    system: account.system,
  }
}

function accountMapToRow(map: AccountMap): Record<string, unknown> {
  const value: Record<string, string> = {}
  for (const key of Object.keys(DEFAULT_ACCOUNT_MAP) as AccountMapKey[]) {
    value[key] = map[key]
  }
  return { id: MAP_ID, value }
}

function journalToRow(entry: JournalEntry): Record<string, unknown> {
  return {
    id: entry.id,
    date: entry.date,
    memo: entry.memo,
    source_key: entry.sourceKey ?? null,
    source_type: entry.sourceType,
    manual: entry.manual,
    created_by: entry.createdBy,
    created_at_label: entry.createdAt,
    voided_at: entry.voidedAt ?? null,
    reverses_id: entry.reversesId ?? null,
    reversed_by_id: entry.reversedById ?? null,
  }
}

function journalLineToRow(
  journalId: string,
  line: JournalLine,
  index: number,
): Record<string, unknown> {
  return {
    id: projectChildId(journalId, undefined, index),
    journal_id: journalId,
    account_id: line.accountId,
    debit: line.debit,
    credit: line.credit,
    memo: line.memo ?? null,
  }
}

function lineToPayload(line: JournalLine): Record<string, unknown> {
  const row: Record<string, unknown> = {
    accountId: line.accountId,
    debit: line.debit,
    credit: line.credit,
  }
  if (line.memo) row.memo = line.memo
  return row
}

function payloadToJson(payload: FailedJournalPost['payload']): Record<string, unknown> {
  const row: Record<string, unknown> = {
    date: payload.date,
    memo: payload.memo,
    sourceType: payload.sourceType,
    manual: payload.manual,
    lines: payload.lines.map(lineToPayload),
    createdBy: payload.createdBy,
  }
  if (payload.sourceKey) row.sourceKey = payload.sourceKey
  if (payload.reversesId) row.reversesId = payload.reversesId
  return row
}

function failedPostToRow(post: FailedJournalPost): Record<string, unknown> {
  return {
    id: post.sourceKey,
    source_key: post.sourceKey,
    payload: payloadToJson(post.payload),
    error: post.error,
    created_at_label: post.createdAt,
  }
}

export function assembleGl(base: GlSnapshot): GlSnapshot | null {
  const accounts = getRelationalCache('gl_accounts')
  const accountMap = getRelationalCache('gl_account_map')
  const journals = getRelationalCache('gl_journals')
  const journalLines = getRelationalCache('gl_journal_lines')
  const failedPosts = getRelationalCache('gl_failed_posts')
  if (!accounts || !accountMap || !journals || !journalLines || !failedPosts) return null

  const linesByJournal = rowsByParent(journalLines, 'journal_id')
  const journalDocs = journals.map((row) => {
    const id = reqStr(row.id)
    const lineRows = (linesByJournal.get(id) ?? [])
      .slice()
      .sort((a, b) => compareChildId(id, reqStr(a.id), reqStr(b.id)))
    return journalFromRow(row, lineRows.map(journalLineFromRow))
  })

  return {
    ...base,
    accounts: accounts.map(accountFromRow),
    accountMap: accountMapFromRows(accountMap),
    journals: journalDocs,
    failedPosts: failedPosts.map(failedPostFromRow),
    updatedAt: new Date().toISOString(),
  }
}

export function projectGl(
  snap: GlSnapshot,
): Partial<Record<OpsTableName, Record<string, unknown>[]>> {
  const journalRows: Record<string, unknown>[] = []
  const lineRows: Record<string, unknown>[] = []
  for (const entry of snap.journals) {
    journalRows.push(journalToRow(entry))
    for (let i = 0; i < entry.lines.length; i++) {
      lineRows.push(journalLineToRow(entry.id, entry.lines[i], i))
    }
  }

  return {
    gl_accounts: snap.accounts.map(accountToRow),
    gl_account_map: [accountMapToRow(snap.accountMap)],
    gl_journals: journalRows,
    gl_journal_lines: lineRows,
    gl_failed_posts: snap.failedPosts.map(failedPostToRow),
  }
}
