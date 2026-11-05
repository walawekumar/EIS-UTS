import { loadStoredUser } from '@/lib/auth-storage'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase-client'
import { SETTINGS_KEY, notifySettingsChanged } from '@/features/settings/app-settings'

const ORG_ID = 'org'
const ORG_KEYS = ['company', 'finance', 'stock', 'docs'] as const
const USER_KEYS = ['profile', 'prefs', 'notif', 'security'] as const

type SettingsBag = Record<string, unknown>

function userSettingsId(userId: string) {
  return `user:${userId}`
}

function readLocal(): SettingsBag {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as SettingsBag
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocal(next: SettingsBag) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  notifySettingsChanged()
}

function pick(source: SettingsBag, keys: readonly string[]): SettingsBag {
  const out: SettingsBag = {}
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key]
  }
  return out
}

/** Tarik pengaturan org + pengguna ke localStorage sebelum modul membaca. */
export async function hydrateAppSettings(): Promise<void> {
  if (!isSupabaseConfigured()) return
  const sb = getSupabase()
  if (!sb) return
  const { data: sessionData } = await sb.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) return

  const { data, error } = await sb
    .from('app_settings')
    .select('id, payload')
    .in('id', [ORG_ID, userSettingsId(userId)])
  if (error || !data) return

  const org = data.find((row) => row.id === ORG_ID)?.payload
  const mine = data.find((row) => row.id === userSettingsId(userId))?.payload
  const next = {
    ...readLocal(),
    ...(org && typeof org === 'object' ? org : null),
    ...(mine && typeof mine === 'object' ? mine : null),
  }
  writeLocal(next)
}

/** Simpan pengaturan. Org (perusahaan, keuangan, stok, dokumen) hanya admin. */
export async function pushAppSettings(full: SettingsBag): Promise<void> {
  if (!isSupabaseConfigured()) return
  const sb = getSupabase()
  if (!sb) return
  const { data: sessionData } = await sb.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) return

  const now = new Date().toISOString()
  const userRow = {
    id: userSettingsId(userId),
    payload: pick(full, USER_KEYS),
    updated_at: now,
  }
  const { error: userError } = await sb.from('app_settings').upsert(userRow)
  if (userError) throw userError

  if (loadStoredUser()?.role !== 'admin') return
  const { error: orgError } = await sb.from('app_settings').upsert({
    id: ORG_ID,
    payload: pick(full, ORG_KEYS),
    updated_at: now,
  })
  if (orgError) throw orgError
}
