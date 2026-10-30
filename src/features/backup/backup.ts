/** Export / import snapshot seluruh key egabah.* (pra-cloud). */

const KEYS = [
  'egabah.persediaan.v1',
  'egabah.pembelian.v1',
  'egabah.penjualan.v1',
  'egabah.produksi.v1',
  'egabah.keuangan.v1',
  'egabah.master.v1',
  'egabah.audit.v1',
  'egabah.payroll.v1',
  'egabah.settings.v2',
] as const

export type AppBackup = {
  version: 1
  exportedAt: string
  app: 'egabah'
  data: Record<string, unknown>
}

export function buildBackup(): AppBackup {
  const data: Record<string, unknown> = {}
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) data[key] = JSON.parse(raw)
    } catch {
      // skip corrupt
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'egabah',
    data,
  }
}

export function downloadBackup() {
  const backup = buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `egabah-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function restoreBackup(payload: unknown): { ok: true } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'File tidak valid' }
  }
  const p = payload as AppBackup
  if (p.version !== 1 || p.app !== 'egabah' || !p.data || typeof p.data !== 'object') {
    return { ok: false, error: 'Bukan backup E-Gabah v1' }
  }
  try {
    for (const [key, value] of Object.entries(p.data)) {
      if (!key.startsWith('egabah.')) continue
      localStorage.setItem(key, JSON.stringify(value))
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Gagal menulis localStorage' }
  }
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
