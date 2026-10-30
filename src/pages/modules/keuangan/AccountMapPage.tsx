import { useEffect, useMemo, useState } from 'react'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { Select } from '@/components/ui/Select'
import {
  type Account,
  type AccountMap,
  type AccountMapKey,
  DEFAULT_ACCOUNT_MAP,
} from '@/features/keuangan/gl-data'
import { useFinanceStore } from '@/features/keuangan/finance-store'

const MAP_KEYS = Object.keys(DEFAULT_ACCOUNT_MAP) as AccountMapKey[]

const MAP_KEY_LABEL: Record<AccountMapKey, string> = {
  cash: 'Kas & bank',
  ap: 'Utang usaha (AP)',
  ar: 'Piutang usaha (AR)',
  inventoryGabah: 'Persediaan gabah',
  inventoryBeras: 'Persediaan beras',
  wip: 'Work in process (WIP)',
  cogs: 'HPP (COGS)',
  sales: 'Penjualan',
  salesReturn: 'Retur penjualan',
  expenseOps: 'Beban operasional',
  payroll: 'Beban gaji',
  mfgOverhead: 'Overhead produksi',
  openingEquity: 'Modal / saldo awal',
}

function accountOptionLabel(a: Account): string {
  return `${a.code} · ${a.name}`
}

function buildAccountOptions(
  accounts: Account[],
  selectedId: string,
): { value: string; label: string; description?: string }[] {
  const postableActive = accounts.filter((a) => a.isPostable && a.active)
  const ids = new Set(postableActive.map((a) => a.id))
  const list = [...postableActive]
  if (selectedId && !ids.has(selectedId)) {
    const extra = accounts.find((a) => a.id === selectedId)
    if (extra) list.unshift(extra)
  }
  return list.map((a) => ({
    value: a.id,
    label: accountOptionLabel(a),
    description:
      !a.active || !a.isPostable
        ? 'Akun saat ini nonaktif atau non-postable — pilih pengganti'
        : undefined,
  }))
}

export function AccountMapPage() {
  const { accounts, accountMap, setAccountMap } = useFinanceStore()
  const [draft, setDraft] = useState<AccountMap>(() => ({ ...accountMap }))
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft({ ...accountMap })
  }, [accountMap])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const dirty = useMemo(
    () => MAP_KEYS.some((key) => draft[key] !== accountMap[key]),
    [draft, accountMap],
  )

  function setKey(key: AccountMapKey, accountId: string) {
    setDraft((prev) => ({ ...prev, [key]: accountId }))
    setError(null)
  }

  function save() {
    for (const key of MAP_KEYS) {
      const id = draft[key]
      const acc = accounts.find((a) => a.id === id)
      if (!acc) {
        setError(`Peran "${MAP_KEY_LABEL[key]}": pilih akun yang valid.`)
        return
      }
      if (!acc.isPostable || !acc.active) {
        setError(
          `Peran "${MAP_KEY_LABEL[key]}": akun harus aktif dan bisa diposting.`,
        )
        return
      }
    }
    setAccountMap({ ...draft })
    setToast('Pemetaan akun default disimpan')
    setError(null)
  }

  function resetDraft() {
    setDraft({ ...accountMap })
    setError(null)
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Pemetaan akun default
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Tentukan akun GL untuk jurnal otomatis dari modul operasional
            </p>
          </div>
          <FinanceToast message={toast} />
        </div>

        {error ? (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          {MAP_KEYS.map((key) => (
            <Select
              key={key}
              label={MAP_KEY_LABEL[key]}
              value={draft[key]}
              options={buildAccountOptions(accounts, draft[key])}
              onChange={(accountId) => setKey(key, accountId)}
              requiredMark
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dirty}
            onClick={save}
            className="h-11 rounded-xl bg-brand-800 px-5 text-[14px] font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Simpan pemetaan
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={resetDraft}
            className="h-11 rounded-xl border border-line px-5 text-[14px] font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-45"
          >
            Batalkan perubahan
          </button>
        </div>
      </section>
    </div>
  )
}
