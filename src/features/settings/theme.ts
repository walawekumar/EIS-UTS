export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeAccent = 'green' | 'blue' | 'teal'

export type ThemePrefs = {
  mode: ThemeMode
  accent: ThemeAccent
}

export const THEME_STORAGE_KEY = 'egabah.settings.v2'

const DEFAULT_THEME: ThemePrefs = {
  mode: 'light',
  accent: 'green',
}

export function readThemePrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_THEME }
    const parsed = JSON.parse(raw) as { prefs?: Partial<ThemePrefs> }
    return {
      mode: parsed.prefs?.mode ?? DEFAULT_THEME.mode,
      accent: parsed.prefs?.accent ?? DEFAULT_THEME.accent,
    }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

export function applyTheme(prefs: ThemePrefs) {
  const root = document.documentElement
  const resolved = resolveMode(prefs.mode)
  root.dataset.theme = resolved
  root.dataset.accent = prefs.accent
  root.style.colorScheme = resolved
}

export function initTheme() {
  applyTheme(readThemePrefs())

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    const prefs = readThemePrefs()
    if (prefs.mode === 'system') applyTheme(prefs)
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
