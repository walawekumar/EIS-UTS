// src/features/keuangan/gl-storage.ts
import { createLocalRepository } from '@/lib/create-local-repository'
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

export const glRepository = createLocalRepository({
  key: 'egabah.gl.v1',
  seed,
  isValid,
})
