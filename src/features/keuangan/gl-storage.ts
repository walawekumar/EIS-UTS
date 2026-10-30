import { createLocalRepository } from '@/lib/create-local-repository'
import { assembleGl, projectGl } from '@/lib/ops-relational/mappers/gl'
import { createRelationalBackedRepository } from '@/lib/relational-backed-repository'
import {
  DEFAULT_ACCOUNT_MAP,
  SEED_ACCOUNTS,
  type GlSnapshot,
} from '@/features/keuangan/gl-data'

function seed(): GlSnapshot {
  return {
    version: 1,
    accounts: structuredClone(SEED_ACCOUNTS),
    accountMap: { ...DEFAULT_ACCOUNT_MAP },
    journals: [],
    failedPosts: [],
    updatedAt: new Date().toISOString(),
  }
}

function isValid(value: unknown): value is GlSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as GlSnapshot
  return (
    v.version === 1 &&
    Array.isArray(v.accounts) &&
    Array.isArray(v.journals) &&
    Array.isArray(v.failedPosts) &&
    v.accountMap != null &&
    typeof v.accountMap === 'object'
  )
}

export function normalizeGlSnapshot(snap: GlSnapshot): GlSnapshot {
  const byId = new Map(snap.accounts.map((a) => [a.id, a]))
  for (const a of SEED_ACCOUNTS) {
    if (!byId.has(a.id)) byId.set(a.id, structuredClone(a))
  }
  const accountMap = { ...DEFAULT_ACCOUNT_MAP, ...snap.accountMap }
  for (const key of Object.keys(DEFAULT_ACCOUNT_MAP) as (keyof typeof DEFAULT_ACCOUNT_MAP)[]) {
    if (!accountMap[key]) accountMap[key] = DEFAULT_ACCOUNT_MAP[key]
  }
  return {
    ...snap,
    accounts: [...byId.values()],
    accountMap,
  }
}

const inner = createLocalRepository({
  key: 'egabah.gl.v1',
  seed,
  isValid,
})

export const glRepository = createRelationalBackedRepository({
  local: inner,
  normalize: normalizeGlSnapshot,
  tables: [
    'gl_accounts',
    'gl_account_map',
    'gl_journals',
    'gl_journal_lines',
    'gl_failed_posts',
  ],
  assemble: assembleGl,
  project: projectGl,
})
