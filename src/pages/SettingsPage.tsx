import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TextAreaField } from '@/components/keuangan/FinanceModal'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { CameraIcon } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { TextField } from '@/components/ui/TextField'
import { downloadBackup, restoreBackup } from '@/features/backup/backup'
import { useAuth } from '@/features/auth/AuthContext'
import { notifySettingsChanged } from '@/features/settings/app-settings'
import {
  applyTheme,
  type ThemeAccent,
  type ThemeMode,
} from '@/features/settings/theme'
import { ROLE_LABELS } from '@/types/auth'

type SettingsTab =
  | 'profil'
  | 'perusahaan'
  | 'keuangan'
  | 'stok'
  | 'dokumen'
  | 'preferensi'
  | 'notifikasi'
  | 'keamanan'
  | 'sesi'

type ProfileForm = {
  name: string
  email: string
  phone: string
  title: string
  employeeId: string
  nik: string
  branch: string
  department: string
  timezone: string
  locale: 'id' | 'en'
  bio: string
  emergencyName: string
  emergencyPhone: string
  signatureName: string
  avatarUrl: string
}

type CompanyForm = {
  name: string
  legalName: string
  brand: string
  npwp: string
  pkp: 'ya' | 'tidak'
  nib: string
  siup: string
  address: string
  city: string
  province: string
  postal: string
  phone: string
  email: string
  website: string
  warehouse: string
  bankName: string
  bankAccount: string
  bankHolder: string
  fiscalStart: string
}

type FinanceForm = {
  currency: 'idr'
  ppnRate: '0' | '11' | '12'
  includePpnDefault: boolean
  paymentTermDays: '0' | '7' | '14' | '30'
  overdueGraceDays: '0' | '3' | '7'
  arAccount: string
  apAccount: string
  cashAccount: string
  lockPeriod: boolean
  requireReceiptPay: boolean
  requireReceiptShip: boolean
}

type StockForm = {
  valuation: 'fifo' | 'average'
  defaultLocation: string
  lowStockAlert: boolean
  lowStockPct: '5' | '10' | '20'
  allowNegative: boolean
  autoConfirmWeigh: boolean
  taraPerSack: string
  varianceTolerance: string
}

type DocForm = {
  invoicePrefix: string
  purchasePrefix: string
  orderPrefix: string
  printFooter: string
  showLogo: boolean
  showNpwp: boolean
  showBank: boolean
  showSignature: boolean
  copyCount: '1' | '2' | '3'
}

type PrefsForm = {
  language: 'id' | 'en'
  dateFormat: 'dmy' | 'ymd'
  numberFormat: 'id' | 'en'
  pageSize: '6' | '10' | '20'
  density: 'comfortable' | 'compact'
  defaultModule: string
  mode: ThemeMode
  accent: ThemeAccent
  confirmDelete: boolean
  soundFeedback: boolean
}

type NotifForm = {
  emailDigest: boolean
  overdueAlert: boolean
  stockLow: boolean
  newOrder: boolean
  paymentReceived: boolean
  weighConfirm: boolean
  browserPush: boolean
  weeklyReport: boolean
}

type SecurityForm = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  twoFactor: boolean
  sessionTimeout: '30' | '60' | '120' | 'never'
  loginAlert: boolean
}

const TABS: Array<{ id: SettingsTab; label: string; hint: string }> = [
  { id: 'profil', label: 'Profil', hint: 'Identitas & kontak Anda' },
  { id: 'perusahaan', label: 'Perusahaan', hint: 'Legal, alamat, rekening' },
  { id: 'keuangan', label: 'Keuangan', hint: 'PPN, tempo, akun default' },
  { id: 'stok', label: 'Persediaan', hint: 'Valuasi & gudang' },
  { id: 'dokumen', label: 'Dokumen & cetak', hint: 'Prefix & kop bukti' },
  { id: 'preferensi', label: 'Preferensi', hint: 'Tema & tampilan' },
  { id: 'notifikasi', label: 'Notifikasi', hint: 'Peringatan operasional' },
  { id: 'keamanan', label: 'Keamanan', hint: 'Kata sandi & 2FA' },
  { id: 'sesi', label: 'Sesi', hint: 'Perangkat & keluar' },
]

const STORAGE_KEY = 'egabah.settings.v2'

type StoredSettings = {
  profile?: Partial<ProfileForm>
  company?: Partial<CompanyForm>
  finance?: Partial<FinanceForm>
  stock?: Partial<StockForm>
  docs?: Partial<DocForm>
  prefs?: Partial<PrefsForm>
  notif?: Partial<NotifForm>
  security?: Partial<Pick<SecurityForm, 'twoFactor' | 'sessionTimeout' | 'loginAlert'>>
}

function loadStored(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as StoredSettings
  } catch {
    return {}
  }
}

function saveStored(patch: StoredSettings) {
  const prev = loadStored()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }))
  notifySettingsChanged()
}

function BackupDataCard({ notify }: { notify: (msg: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <SectionCard
      title="Backup & restore"
      description="Unduh/restore seluruh data lokal (JSON) sebelum pindah ke Supabase/Firebase."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              downloadBackup()
              notify('Backup JSON diunduh')
            }}
            className="h-10 rounded-xl border border-line px-3.5 text-[13px] font-medium text-ink transition hover:bg-surface"
          >
            Unduh backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-10 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900"
          >
            Restore dari file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const text = await file.text()
                const parsed = JSON.parse(text) as unknown
                const result = restoreBackup(parsed)
                if (!result.ok) {
                  notify(result.error)
                  return
                }
                notify('Restore berhasil — memuat ulang…')
                window.setTimeout(() => window.location.reload(), 600)
              } catch {
                notify('File JSON tidak bisa dibaca')
              }
            }}
          />
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        Mencakup master, pembelian, penjualan, produksi, persediaan, keuangan,
        payroll, audit, dan pengaturan. Setelah restore, halaman akan dimuat
        ulang.
      </p>
    </SectionCard>
  )
}

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <header className="border-b border-line px-4 py-3.5 sm:px-5">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{description}</p>
        ) : null}
      </header>
      <div className="space-y-4 px-4 py-4 sm:px-5">{children}</div>
      {footer ? (
        <footer className="border-t border-line bg-surface/50 px-4 py-3 sm:px-5">
          {footer}
        </footer>
      ) : null}
    </section>
  )
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{children}</p>
}

function SaveBar({
  dirty,
  onSave,
  onReset,
}: {
  dirty: boolean
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] text-muted">
        {dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan tersimpan.'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!dirty}
          onClick={onReset}
          className="h-10 rounded-xl border border-line px-3.5 text-[13px] font-medium text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Batalkan
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={onSave}
          className="h-10 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Simpan
        </button>
      </div>
    </div>
  )
}

function SwitchBlock({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-line/80 bg-surface/60 px-3.5 py-3">
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { user, logout } = useAuth()
  const stored = useMemo(() => loadStored(), [])
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<SettingsTab>('profil')
  const [toast, setToast] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string>()

  const defaultProfile: ProfileForm = {
    name: stored.profile?.name ?? user?.name ?? '',
    email: stored.profile?.email ?? user?.email ?? '',
    phone: stored.profile?.phone ?? '0812-3456-7890',
    title: stored.profile?.title ?? user?.roleLabel ?? '',
    employeeId: stored.profile?.employeeId ?? `EG-${user?.role?.slice(0, 3).toUpperCase() ?? 'ADM'}-001`,
    nik: stored.profile?.nik ?? '',
    branch: stored.profile?.branch ?? 'Mill Klaten',
    department: stored.profile?.department ?? user?.roleLabel ?? '',
    timezone: stored.profile?.timezone ?? 'Asia/Jakarta',
    locale: stored.profile?.locale ?? 'id',
    bio: stored.profile?.bio ?? '',
    emergencyName: stored.profile?.emergencyName ?? '',
    emergencyPhone: stored.profile?.emergencyPhone ?? '',
    signatureName: stored.profile?.signatureName ?? user?.name ?? '',
    avatarUrl: stored.profile?.avatarUrl ?? '',
  }

  const defaultCompany: CompanyForm = {
    name: stored.company?.name ?? 'CV E-Gabah Sejahtera',
    legalName: stored.company?.legalName ?? 'CV E-Gabah Sejahtera',
    brand: stored.company?.brand ?? 'E-Gabah',
    npwp: stored.company?.npwp ?? '10.0.1.3-012.000',
    pkp: stored.company?.pkp ?? 'ya',
    nib: stored.company?.nib ?? '1234567890123',
    siup: stored.company?.siup ?? 'SIUP-517/KLATEN/2024',
    address:
      stored.company?.address ??
      'Jl. Raya Penggilingan No. 12, Kawasan Industri Padi',
    city: stored.company?.city ?? 'Klaten',
    province: stored.company?.province ?? 'Jawa Tengah',
    postal: stored.company?.postal ?? '57411',
    phone: stored.company?.phone ?? '(0272) 321-450',
    email: stored.company?.email ?? 'ops@e-gabah.id',
    website: stored.company?.website ?? 'https://e-gabah.id',
    warehouse: stored.company?.warehouse ?? 'Gudang Utama A',
    bankName: stored.company?.bankName ?? 'Bank BRI',
    bankAccount: stored.company?.bankAccount ?? '0123-01-000789-53-2',
    bankHolder: stored.company?.bankHolder ?? 'CV E-Gabah Sejahtera',
    fiscalStart: stored.company?.fiscalStart ?? '01-01',
  }

  const defaultFinance: FinanceForm = {
    currency: 'idr',
    ppnRate: stored.finance?.ppnRate ?? '11',
    includePpnDefault: stored.finance?.includePpnDefault ?? false,
    paymentTermDays: stored.finance?.paymentTermDays ?? '7',
    overdueGraceDays: stored.finance?.overdueGraceDays ?? '3',
    arAccount: stored.finance?.arAccount ?? '1-1200 Piutang Usaha',
    apAccount: stored.finance?.apAccount ?? '2-1100 Utang Usaha',
    cashAccount: stored.finance?.cashAccount ?? '1-1100 Kas & Bank',
    lockPeriod: stored.finance?.lockPeriod ?? false,
    requireReceiptPay: stored.finance?.requireReceiptPay ?? true,
    requireReceiptShip: stored.finance?.requireReceiptShip ?? true,
  }

  const defaultStock: StockForm = {
    valuation: stored.stock?.valuation ?? 'average',
    defaultLocation: stored.stock?.defaultLocation ?? 'Gudang Utama A',
    lowStockAlert: stored.stock?.lowStockAlert ?? true,
    lowStockPct: stored.stock?.lowStockPct ?? '10',
    allowNegative: stored.stock?.allowNegative ?? false,
    autoConfirmWeigh: stored.stock?.autoConfirmWeigh ?? false,
    taraPerSack: stored.stock?.taraPerSack ?? '0,25',
    varianceTolerance: stored.stock?.varianceTolerance ?? '5',
  }

  const defaultDocs: DocForm = {
    invoicePrefix: stored.docs?.invoicePrefix ?? 'AR',
    purchasePrefix: stored.docs?.purchasePrefix ?? 'PB',
    orderPrefix: stored.docs?.orderPrefix ?? 'SO',
    printFooter:
      stored.docs?.printFooter ??
      'Terima kasih. Bukti ini sah tanpa tanda tangan basah bila dicetak dari E-Gabah.',
    showLogo: stored.docs?.showLogo ?? true,
    showNpwp: stored.docs?.showNpwp ?? true,
    showBank: stored.docs?.showBank ?? true,
    showSignature: stored.docs?.showSignature ?? true,
    copyCount: stored.docs?.copyCount ?? '1',
  }

  const defaultPrefs: PrefsForm = {
    language: stored.prefs?.language ?? 'id',
    dateFormat: stored.prefs?.dateFormat ?? 'dmy',
    numberFormat: stored.prefs?.numberFormat ?? 'id',
    pageSize: stored.prefs?.pageSize ?? '6',
    density: stored.prefs?.density ?? 'comfortable',
    defaultModule: stored.prefs?.defaultModule ?? '/app/dashboard',
    mode: stored.prefs?.mode ?? 'light',
    accent: stored.prefs?.accent ?? 'green',
    confirmDelete: stored.prefs?.confirmDelete ?? true,
    soundFeedback: stored.prefs?.soundFeedback ?? false,
  }

  const defaultNotif: NotifForm = {
    emailDigest: stored.notif?.emailDigest ?? true,
    overdueAlert: stored.notif?.overdueAlert ?? true,
    stockLow: stored.notif?.stockLow ?? true,
    newOrder: stored.notif?.newOrder ?? true,
    paymentReceived: stored.notif?.paymentReceived ?? true,
    weighConfirm: stored.notif?.weighConfirm ?? false,
    browserPush: stored.notif?.browserPush ?? false,
    weeklyReport: stored.notif?.weeklyReport ?? true,
  }

  const defaultSecurity: SecurityForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactor: stored.security?.twoFactor ?? false,
    sessionTimeout: stored.security?.sessionTimeout ?? '60',
    loginAlert: stored.security?.loginAlert ?? true,
  }

  const [profile, setProfile] = useState(defaultProfile)
  const [profileBase, setProfileBase] = useState(defaultProfile)
  const [company, setCompany] = useState(defaultCompany)
  const [companyBase, setCompanyBase] = useState(defaultCompany)
  const [finance, setFinance] = useState(defaultFinance)
  const [financeBase, setFinanceBase] = useState(defaultFinance)
  const [stock, setStock] = useState(defaultStock)
  const [stockBase, setStockBase] = useState(defaultStock)
  const [docs, setDocs] = useState(defaultDocs)
  const [docsBase, setDocsBase] = useState(defaultDocs)
  const [prefs, setPrefs] = useState(defaultPrefs)
  const [prefsBase, setPrefsBase] = useState(defaultPrefs)
  const [notif, setNotif] = useState(defaultNotif)
  const [notifBase, setNotifBase] = useState(defaultNotif)
  const [security, setSecurity] = useState(defaultSecurity)
  const [securityBase, setSecurityBase] = useState({
    twoFactor: defaultSecurity.twoFactor,
    sessionTimeout: defaultSecurity.sessionTimeout,
    loginAlert: defaultSecurity.loginAlert,
  })

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  const dirty = {
    profile: JSON.stringify(profile) !== JSON.stringify(profileBase),
    company: JSON.stringify(company) !== JSON.stringify(companyBase),
    finance: JSON.stringify(finance) !== JSON.stringify(financeBase),
    stock: JSON.stringify(stock) !== JSON.stringify(stockBase),
    docs: JSON.stringify(docs) !== JSON.stringify(docsBase),
    prefs: JSON.stringify(prefs) !== JSON.stringify(prefsBase),
    notif: JSON.stringify(notif) !== JSON.stringify(notifBase),
    security:
      security.twoFactor !== securityBase.twoFactor ||
      security.sessionTimeout !== securityBase.sessionTimeout ||
      security.loginAlert !== securityBase.loginAlert,
  }

  const initials = (profile.name || user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  function notify(msg: string) {
    setToast(msg)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="relative">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 text-[18px] font-semibold text-brand-800">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                initials || 'U'
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                if (file.size > 2 * 1024 * 1024) {
                  notify('Foto maksimal 2 MB')
                  return
                }
                const reader = new FileReader()
                reader.onload = () => {
                  const avatarUrl =
                    typeof reader.result === 'string' ? reader.result : ''
                  setProfile((p) => {
                    const next = { ...p, avatarUrl }
                    saveStored({ profile: next })
                    return next
                  })
                  setProfileBase((p) => ({ ...p, avatarUrl }))
                  notify('Foto profil diperbarui')
                }
                reader.readAsDataURL(file)
              }}
            />
            <button
              type="button"
              title="Ganti foto profil"
              aria-label="Ganti foto profil"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border border-line bg-brand-800 text-white shadow-sm transition hover:bg-brand-900"
            >
              <CameraIcon className="size-3.5" />
            </button>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[16px] font-semibold text-ink">
                {profile.name || user?.name}
              </h2>
              <StatusPill
                label={user ? ROLE_LABELS[user.role] : ','}
                tone="good"
              />
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-muted">
              {profile.title} · {profile.branch} · {profile.employeeId}
            </p>
            <p className="mt-1 truncate text-[12px] text-muted">
              {profile.email || user?.email} · {company.name}
            </p>
          </div>
        </div>
        <FinanceToast message={toast} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[232px_minmax(0,1fr)]">
        <nav className="h-fit rounded-2xl border border-line bg-panel p-2 lg:sticky lg:top-0">
          <p className="px-2.5 py-2 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
            Menu pengaturan
          </p>
          <ul className="space-y-0.5">
            {TABS.map((item) => {
              const active = tab === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={[
                      'flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition',
                      active
                        ? 'bg-brand-50 text-brand-900'
                        : 'text-ink hover:bg-surface',
                    ].join(' ')}
                  >
                    <span className="text-[13px] font-medium">{item.label}</span>
                    <span
                      className={[
                        'mt-0.5 text-[11.5px]',
                        active ? 'text-brand-700/80' : 'text-muted',
                      ].join(' ')}
                    >
                      {item.hint}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-3">
          {tab === 'profil' ? (
            <>
              <SectionCard
                title="Identitas pribadi"
                description="Data yang muncul di aktivitas, dokumen, dan tanda tangan cetak."
                footer={
                  <SaveBar
                    dirty={dirty.profile}
                    onReset={() => setProfile(profileBase)}
                    onSave={() => {
                      const next = {
                        ...profile,
                        // Field sistem — tidak boleh diubah user
                        employeeId: profileBase.employeeId,
                        title: profileBase.title,
                        department: profileBase.department,
                        branch: profileBase.branch,
                        email: profileBase.email,
                      }
                      setProfile(next)
                      setProfileBase(next)
                      saveStored({ profile: next })
                      notify('Profil disimpan')
                    }}
                  />
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    id="set-name"
                    label="Nama lengkap"
                    requiredMark
                    value={profile.name}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                  <TextField
                    id="set-emp"
                    label="ID karyawan"
                    value={profile.employeeId}
                    readOnly
                    title="Ditetapkan sistem saat akun dibuat"
                  />
                  <TextField
                    id="set-title"
                    label="Jabatan"
                    value={profile.title}
                    readOnly
                    title="Ditetapkan admin / Master Data"
                  />
                  <TextField
                    id="set-dept"
                    label="Departemen"
                    value={profile.department}
                    readOnly
                    title="Ditetapkan admin / Master Data"
                  />
                  <TextField
                    id="set-branch"
                    label="Cabang / mill"
                    value={profile.branch}
                    readOnly
                    title="Ditetapkan admin / Master Data"
                  />
                  <TextField
                    id="set-email"
                    label="Email kerja"
                    type="email"
                    value={profile.email}
                    readOnly
                    title="Email login — diubah admin"
                  />
                  <TextField
                    id="set-nik"
                    label="NIK (opsional)"
                    value={profile.nik}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, nik: e.target.value }))
                    }
                    placeholder="16 digit"
                  />
                  <TextField
                    id="set-phone"
                    label="No. WhatsApp / telepon"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                  <Select
                    label="Zona waktu"
                    value={profile.timezone}
                    options={[
                      { value: 'Asia/Jakarta', label: 'WIB · Asia/Jakarta' },
                      { value: 'Asia/Makassar', label: 'WITA · Asia/Makassar' },
                      { value: 'Asia/Jayapura', label: 'WIT · Asia/Jayapura' },
                    ]}
                    onChange={(timezone) => setProfile((p) => ({ ...p, timezone }))}
                  />
                  <Select
                    label="Bahasa profil"
                    value={profile.locale}
                    options={[
                      { value: 'id', label: 'Bahasa Indonesia' },
                      { value: 'en', label: 'English' },
                    ]}
                    onChange={(locale) => setProfile((p) => ({ ...p, locale }))}
                  />
                </div>
                <TextAreaField
                  id="set-bio"
                  label="Catatan / bio singkat"
                  value={profile.bio}
                  onChange={(bio) => setProfile((p) => ({ ...p, bio }))}
                  placeholder="Mis. fokus tanggung jawab timbang shift pagi"
                  rows={2}
                />
                <TextField
                  id="set-sign"
                  label="Nama di tanda tangan cetak"
                  value={profile.signatureName}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, signatureName: e.target.value }))
                  }
                />
                <FieldHint>
                  Field abu-abu (ID, jabatan, departemen, cabang, email) ditetapkan
                  sistem / admin — ubah lewat Master Data · Pengguna. Peran:{' '}
                  <span className="font-medium text-ink">{user?.roleLabel}</span>.
                </FieldHint>
              </SectionCard>

              <SectionCard
                title="Kontak darurat"
                description="Opsional — untuk operasional lapangan / keamanan mill."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    id="set-em-name"
                    label="Nama kontak"
                    value={profile.emergencyName}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        emergencyName: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    id="set-em-phone"
                    label="No. telepon"
                    value={profile.emergencyPhone}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        emergencyPhone: e.target.value,
                      }))
                    }
                  />
                </div>
              </SectionCard>
            </>
          ) : null}

          {tab === 'perusahaan' ? (
            <SectionCard
              title="Profil organisasi"
              description="Mengikuti pola ERP: identitas legal, kontak, bank, dan tahun buku — muncul di invoice & laporan."
              footer={
                <SaveBar
                  dirty={dirty.company}
                  onReset={() => setCompany(companyBase)}
                  onSave={() => {
                    setCompanyBase(company)
                    saveStored({ company })
                    notify('Data perusahaan disimpan')
                  }}
                />
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="co-brand"
                  label="Nama merek / brand"
                  value={company.brand}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, brand: e.target.value }))
                  }
                />
                <TextField
                  id="co-name"
                  label="Nama tampilan"
                  requiredMark
                  value={company.name}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, name: e.target.value }))
                  }
                />
                <TextField
                  id="co-legal"
                  label="Nama legal (sesuai akta)"
                  value={company.legalName}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, legalName: e.target.value }))
                  }
                />
                <Select
                  label="Status PKP"
                  value={company.pkp}
                  options={[
                    { value: 'ya', label: 'PKP' },
                    { value: 'tidak', label: 'Non-PKP' },
                  ]}
                  onChange={(pkp) => setCompany((c) => ({ ...c, pkp }))}
                />
                <TextField
                  id="co-npwp"
                  label="NPWP"
                  value={company.npwp}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, npwp: e.target.value }))
                  }
                />
                <TextField
                  id="co-nib"
                  label="NIB"
                  value={company.nib}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, nib: e.target.value }))
                  }
                />
                <TextField
                  id="co-siup"
                  label="SIUP / izin usaha"
                  value={company.siup}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, siup: e.target.value }))
                  }
                />
                <TextField
                  id="co-fiscal"
                  label="Awal tahun buku (MM-DD)"
                  value={company.fiscalStart}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, fiscalStart: e.target.value }))
                  }
                  placeholder="01-01"
                />
                <TextField
                  id="co-city"
                  label="Kota"
                  value={company.city}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, city: e.target.value }))
                  }
                />
                <TextField
                  id="co-prov"
                  label="Provinsi"
                  value={company.province}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, province: e.target.value }))
                  }
                />
                <TextField
                  id="co-postal"
                  label="Kode pos"
                  value={company.postal}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, postal: e.target.value }))
                  }
                />
                <TextField
                  id="co-wh"
                  label="Gudang default"
                  value={company.warehouse}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, warehouse: e.target.value }))
                  }
                />
                <TextField
                  id="co-phone"
                  label="Telepon kantor"
                  value={company.phone}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, phone: e.target.value }))
                  }
                />
                <TextField
                  id="co-email"
                  label="Email operasional"
                  type="email"
                  value={company.email}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, email: e.target.value }))
                  }
                />
                <TextField
                  id="co-web"
                  label="Website"
                  value={company.website}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, website: e.target.value }))
                  }
                />
              </div>
              <TextAreaField
                id="co-address"
                label="Alamat lengkap"
                value={company.address}
                onChange={(address) => setCompany((c) => ({ ...c, address }))}
                rows={2}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  id="co-bank"
                  label="Bank"
                  value={company.bankName}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, bankName: e.target.value }))
                  }
                />
                <TextField
                  id="co-rekening"
                  label="No. rekening"
                  value={company.bankAccount}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, bankAccount: e.target.value }))
                  }
                />
                <TextField
                  id="co-holder"
                  label="Atas nama"
                  value={company.bankHolder}
                  onChange={(e) =>
                    setCompany((c) => ({ ...c, bankHolder: e.target.value }))
                  }
                />
              </div>
              <FieldHint>
                Logo perusahaan: unggah menyusul (MVP menampilkan brand teks di
                cetakan).
              </FieldHint>
            </SectionCard>
          ) : null}

          {tab === 'keuangan' ? (
            <SectionCard
              title="Pengaturan akuntansi"
              description="Default PPN, tempo bayar, akun, dan kontrol bukti — ala Accounts Settings ERP."
              footer={
                <SaveBar
                  dirty={dirty.finance}
                  onReset={() => setFinance(financeBase)}
                  onSave={() => {
                    setFinanceBase(finance)
                    saveStored({ finance })
                    notify('Pengaturan keuangan disimpan')
                  }}
                />
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Mata uang default"
                  value={finance.currency}
                  options={[{ value: 'idr', label: 'Rupiah (IDR)' }]}
                  onChange={(currency) => setFinance((f) => ({ ...f, currency }))}
                />
                <Select
                  label="Tarif PPN default"
                  value={finance.ppnRate}
                  options={[
                    { value: '0', label: '0% (non-PPN)' },
                    { value: '11', label: '11%' },
                    { value: '12', label: '12%' },
                  ]}
                  onChange={(ppnRate) => setFinance((f) => ({ ...f, ppnRate }))}
                />
                <Select
                  label="Tempo bayar default"
                  value={finance.paymentTermDays}
                  options={[
                    { value: '0', label: 'Tunai / COD' },
                    { value: '7', label: '7 hari' },
                    { value: '14', label: '14 hari' },
                    { value: '30', label: '30 hari' },
                  ]}
                  onChange={(paymentTermDays) =>
                    setFinance((f) => ({ ...f, paymentTermDays }))
                  }
                />
                <Select
                  label="Grace overdue"
                  value={finance.overdueGraceDays}
                  options={[
                    { value: '0', label: 'Tanpa grace' },
                    { value: '3', label: '3 hari' },
                    { value: '7', label: '7 hari' },
                  ]}
                  onChange={(overdueGraceDays) =>
                    setFinance((f) => ({ ...f, overdueGraceDays }))
                  }
                />
                <TextField
                  id="fin-ar"
                  label="Akun piutang default"
                  value={finance.arAccount}
                  onChange={(e) =>
                    setFinance((f) => ({ ...f, arAccount: e.target.value }))
                  }
                />
                <TextField
                  id="fin-ap"
                  label="Akun utang default"
                  value={finance.apAccount}
                  onChange={(e) =>
                    setFinance((f) => ({ ...f, apAccount: e.target.value }))
                  }
                />
                <TextField
                  id="fin-cash"
                  label="Akun kas/bank default"
                  value={finance.cashAccount}
                  onChange={(e) =>
                    setFinance((f) => ({ ...f, cashAccount: e.target.value }))
                  }
                  className="sm:col-span-2"
                />
              </div>
              <SwitchBlock>
                <Switch
                  id="fin-ppn"
                  label="Sertakan PPN otomatis di dokumen baru"
                  checked={finance.includePpnDefault}
                  onChange={(includePpnDefault) =>
                    setFinance((f) => ({ ...f, includePpnDefault }))
                  }
                />
                <Switch
                  id="fin-lock"
                  label="Kunci periode buku (cegah edit transaksi lama)"
                  checked={finance.lockPeriod}
                  onChange={(lockPeriod) =>
                    setFinance((f) => ({ ...f, lockPeriod }))
                  }
                />
                <Switch
                  id="fin-rcpt-pay"
                  label="Wajib bukti saat bayar / terima bayar"
                  checked={finance.requireReceiptPay}
                  onChange={(requireReceiptPay) =>
                    setFinance((f) => ({ ...f, requireReceiptPay }))
                  }
                />
                <Switch
                  id="fin-rcpt-ship"
                  label="Wajib surat jalan / nota saat kirim"
                  checked={finance.requireReceiptShip}
                  onChange={(requireReceiptShip) =>
                    setFinance((f) => ({ ...f, requireReceiptShip }))
                  }
                />
              </SwitchBlock>
            </SectionCard>
          ) : null}

          {tab === 'stok' ? (
            <SectionCard
              title="Persediaan & timbang"
              description="Valuasi stok, gudang default, dan toleransi timbang gabah."
              footer={
                <SaveBar
                  dirty={dirty.stock}
                  onReset={() => setStock(stockBase)}
                  onSave={() => {
                    setStockBase(stock)
                    saveStored({ stock })
                    notify('Pengaturan persediaan disimpan')
                  }}
                />
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Metode valuasi"
                  value={stock.valuation}
                  options={[
                    {
                      value: 'average',
                      label: 'Rata-rata tertimbang',
                      description: 'Umum untuk beras & gabah',
                    },
                    {
                      value: 'fifo',
                      label: 'FIFO',
                      description: 'Masuk pertama keluar pertama',
                    },
                  ]}
                  onChange={(valuation) => setStock((s) => ({ ...s, valuation }))}
                />
                <TextField
                  id="st-loc"
                  label="Lokasi / gudang default"
                  value={stock.defaultLocation}
                  onChange={(e) =>
                    setStock((s) => ({ ...s, defaultLocation: e.target.value }))
                  }
                />
                <Select
                  label="Ambang stok rendah"
                  value={stock.lowStockPct}
                  options={[
                    { value: '5', label: '5% di atas minimum' },
                    { value: '10', label: '10% di atas minimum' },
                    { value: '20', label: '20% di atas minimum' },
                  ]}
                  onChange={(lowStockPct) =>
                    setStock((s) => ({ ...s, lowStockPct }))
                  }
                />
                <TextField
                  id="st-tara"
                  label="Tara default per karung (kg)"
                  value={stock.taraPerSack}
                  onChange={(e) =>
                    setStock((s) => ({ ...s, taraPerSack: e.target.value }))
                  }
                />
                <TextField
                  id="st-var"
                  label="Toleransi selisih timbang (%)"
                  value={stock.varianceTolerance}
                  onChange={(e) =>
                    setStock((s) => ({
                      ...s,
                      varianceTolerance: e.target.value,
                    }))
                  }
                />
              </div>
              <SwitchBlock>
                <Switch
                  id="st-low"
                  label="Aktifkan peringatan stok rendah"
                  checked={stock.lowStockAlert}
                  onChange={(lowStockAlert) =>
                    setStock((s) => ({ ...s, lowStockAlert }))
                  }
                />
                <Switch
                  id="st-neg"
                  label="Izinkan stok negatif (tidak disarankan)"
                  checked={stock.allowNegative}
                  onChange={(allowNegative) =>
                    setStock((s) => ({ ...s, allowNegative }))
                  }
                />
                <Switch
                  id="st-auto"
                  label="Auto-konfirmasi berat bila selisih dalam toleransi"
                  checked={stock.autoConfirmWeigh}
                  onChange={(autoConfirmWeigh) =>
                    setStock((s) => ({ ...s, autoConfirmWeigh }))
                  }
                />
              </SwitchBlock>
            </SectionCard>
          ) : null}

          {tab === 'dokumen' ? (
            <SectionCard
              title="Dokumen & cetakan"
              description="Prefix nomor dokumen dan isi kop bukti (mirip print format Zoho/ERPNext)."
              footer={
                <SaveBar
                  dirty={dirty.docs}
                  onReset={() => setDocs(docsBase)}
                  onSave={() => {
                    setDocsBase(docs)
                    saveStored({ docs })
                    notify('Pengaturan dokumen disimpan')
                  }}
                />
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  id="doc-ar"
                  label="Prefix tagihan / AR"
                  value={docs.invoicePrefix}
                  onChange={(e) =>
                    setDocs((d) => ({ ...d, invoicePrefix: e.target.value }))
                  }
                />
                <TextField
                  id="doc-pb"
                  label="Prefix pembelian"
                  value={docs.purchasePrefix}
                  onChange={(e) =>
                    setDocs((d) => ({ ...d, purchasePrefix: e.target.value }))
                  }
                />
                <TextField
                  id="doc-so"
                  label="Prefix order jual"
                  value={docs.orderPrefix}
                  onChange={(e) =>
                    setDocs((d) => ({ ...d, orderPrefix: e.target.value }))
                  }
                />
              </div>
              <Select
                label="Salinan cetak default"
                value={docs.copyCount}
                options={[
                  { value: '1', label: '1 lembar' },
                  { value: '2', label: '2 lembar' },
                  { value: '3', label: '3 lembar' },
                ]}
                onChange={(copyCount) => setDocs((d) => ({ ...d, copyCount }))}
              />
              <TextAreaField
                id="doc-footer"
                label="Catatan kaki cetakan"
                value={docs.printFooter}
                onChange={(printFooter) => setDocs((d) => ({ ...d, printFooter }))}
                rows={2}
              />
              <SwitchBlock>
                <Switch
                  id="doc-logo"
                  label="Tampilkan brand di header cetak"
                  checked={docs.showLogo}
                  onChange={(showLogo) => setDocs((d) => ({ ...d, showLogo }))}
                />
                <Switch
                  id="doc-npwp"
                  label="Tampilkan NPWP di bukti"
                  checked={docs.showNpwp}
                  onChange={(showNpwp) => setDocs((d) => ({ ...d, showNpwp }))}
                />
                <Switch
                  id="doc-bank"
                  label="Tampilkan rekening bank di tagihan"
                  checked={docs.showBank}
                  onChange={(showBank) => setDocs((d) => ({ ...d, showBank }))}
                />
                <Switch
                  id="doc-sign"
                  label="Tampilkan area tanda tangan"
                  checked={docs.showSignature}
                  onChange={(showSignature) =>
                    setDocs((d) => ({ ...d, showSignature }))
                  }
                />
              </SwitchBlock>
            </SectionCard>
          ) : null}

          {tab === 'preferensi' ? (
            <>
              <SectionCard
                title="Tema tampilan"
                description="Mode terang/gelap dan aksen warna brand. Perubahan langsung diterapkan."
                footer={
                  <SaveBar
                    dirty={dirty.prefs}
                    onReset={() => {
                      setPrefs(prefsBase)
                      applyTheme({
                        mode: prefsBase.mode,
                        accent: prefsBase.accent,
                      })
                    }}
                    onSave={() => {
                      setPrefsBase(prefs)
                      saveStored({ prefs })
                      applyTheme({ mode: prefs.mode, accent: prefs.accent })
                      notify('Preferensi & tema disimpan')
                    }}
                  />
                }
              >
                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink">Mode</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          id: 'light' as const,
                          label: 'Terang',
                          hint: 'Latar hijau muda',
                        },
                        {
                          id: 'dark' as const,
                          label: 'Gelap',
                          hint: 'Nyaman di malam hari',
                        },
                        {
                          id: 'system' as const,
                          label: 'Sistem',
                          hint: 'Ikuti OS',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = prefs.mode === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setPrefs((p) => {
                              const next = { ...p, mode: opt.id }
                              applyTheme({
                                mode: next.mode,
                                accent: next.accent,
                              })
                              return next
                            })
                          }}
                          className={[
                            'rounded-xl border px-3.5 py-3 text-left transition',
                            active
                              ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100'
                              : 'border-line bg-surface/60 hover:border-brand-300 hover:bg-panel',
                          ].join(' ')}
                        >
                          <span className="block text-[13px] font-semibold text-ink">
                            {opt.label}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] text-muted">
                            {opt.hint}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink">
                    Aksen warna
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          id: 'green' as const,
                          label: 'Hijau padi',
                          swatch: '#1a4d36',
                        },
                        {
                          id: 'blue' as const,
                          label: 'Biru laut',
                          swatch: '#163a63',
                        },
                        {
                          id: 'teal' as const,
                          label: 'Teal mill',
                          swatch: '#0f4540',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = prefs.accent === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setPrefs((p) => {
                              const next = { ...p, accent: opt.id }
                              applyTheme({
                                mode: next.mode,
                                accent: next.accent,
                              })
                              return next
                            })
                          }}
                          className={[
                            'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition',
                            active
                              ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100'
                              : 'border-line bg-surface/60 hover:border-brand-300 hover:bg-panel',
                          ].join(' ')}
                        >
                          <span
                            className="size-8 shrink-0 rounded-lg border border-black/10 shadow-sm"
                            style={{ background: opt.swatch }}
                            aria-hidden
                          />
                          <span className="text-[13px] font-semibold text-ink">
                            {opt.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3">
                  <p className="text-[12px] text-muted">Pratinjau aksen</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <span className="inline-flex h-8 items-center rounded-lg bg-brand-800 px-3 text-[12px] font-semibold text-white">
                      Primer
                    </span>
                    <span className="inline-flex h-8 items-center rounded-lg border border-brand-300 bg-brand-50 px-3 text-[12px] font-medium text-brand-800">
                      Soft
                    </span>
                    <span className="inline-flex h-8 items-center rounded-lg border border-line bg-panel px-3 text-[12px] text-ink">
                      Panel
                    </span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Preferensi tampilan"
                description="Bahasa, format, dan perilaku UI di perangkat ini."
                footer={
                  <SaveBar
                    dirty={dirty.prefs}
                    onReset={() => {
                      setPrefs(prefsBase)
                      applyTheme({
                        mode: prefsBase.mode,
                        accent: prefsBase.accent,
                      })
                    }}
                    onSave={() => {
                      setPrefsBase(prefs)
                      saveStored({ prefs })
                      applyTheme({ mode: prefs.mode, accent: prefs.accent })
                      notify('Preferensi disimpan')
                    }}
                  />
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Bahasa UI"
                    value={prefs.language}
                    options={[
                      { value: 'id', label: 'Bahasa Indonesia' },
                      { value: 'en', label: 'English' },
                    ]}
                    onChange={(language) =>
                      setPrefs((p) => ({ ...p, language }))
                    }
                  />
                  <Select
                    label="Format tanggal"
                    value={prefs.dateFormat}
                    options={[
                      { value: 'dmy', label: '29 Okt 2026' },
                      { value: 'ymd', label: '2026-10-29' },
                    ]}
                    onChange={(dateFormat) =>
                      setPrefs((p) => ({ ...p, dateFormat }))
                    }
                  />
                  <Select
                    label="Format angka"
                    value={prefs.numberFormat}
                    options={[
                      { value: 'id', label: '1.250.000,50 (ID)' },
                      { value: 'en', label: '1,250,000.50 (EN)' },
                    ]}
                    onChange={(numberFormat) =>
                      setPrefs((p) => ({ ...p, numberFormat }))
                    }
                  />
                  <Select
                    label="Baris per tabel"
                    value={prefs.pageSize}
                    options={[
                      { value: '6', label: '6 baris' },
                      { value: '10', label: '10 baris' },
                      { value: '20', label: '20 baris' },
                    ]}
                    onChange={(pageSize) =>
                      setPrefs((p) => ({ ...p, pageSize }))
                    }
                  />
                  <Select
                    label="Kepadatan UI"
                    value={prefs.density}
                    options={[
                      { value: 'comfortable', label: 'Nyaman' },
                      { value: 'compact', label: 'Padat' },
                    ]}
                    onChange={(density) =>
                      setPrefs((p) => ({ ...p, density }))
                    }
                  />
                  <Select
                    label="Halaman awal setelah login"
                    value={prefs.defaultModule}
                    options={[
                      { value: '/app/dashboard', label: 'Dashboard' },
                      { value: '/app/pembelian', label: 'Pembelian' },
                      { value: '/app/penjualan', label: 'Penjualan' },
                      { value: '/app/persediaan', label: 'Persediaan' },
                      { value: '/app/keuangan', label: 'Keuangan' },
                    ]}
                    onChange={(defaultModule) =>
                      setPrefs((p) => ({ ...p, defaultModule }))
                    }
                  />
                </div>
                <SwitchBlock>
                  <Switch
                    id="pref-del"
                    label="Konfirmasi sebelum menghapus dokumen"
                    checked={prefs.confirmDelete}
                    onChange={(confirmDelete) =>
                      setPrefs((p) => ({ ...p, confirmDelete }))
                    }
                  />
                  <Switch
                    id="pref-sound"
                    label="Suara umpan balik aksi (simpan / error)"
                    checked={prefs.soundFeedback}
                    onChange={(soundFeedback) =>
                      setPrefs((p) => ({ ...p, soundFeedback }))
                    }
                  />
                </SwitchBlock>
              </SectionCard>
            </>
          ) : null}

          {tab === 'notifikasi' ? (
            <SectionCard
              title="Notifikasi operasional"
              description="Pilih peringatan yang masuk ke bell dan email ringkas."
              footer={
                <SaveBar
                  dirty={dirty.notif}
                  onReset={() => setNotif(notifBase)}
                  onSave={() => {
                    setNotifBase(notif)
                    saveStored({ notif })
                    notify('Notifikasi disimpan')
                  }}
                />
              }
            >
              <SwitchBlock>
                <Switch
                  id="n-digest"
                  label="Ringkasan harian lewat email"
                  checked={notif.emailDigest}
                  onChange={(emailDigest) =>
                    setNotif((n) => ({ ...n, emailDigest }))
                  }
                />
                <Switch
                  id="n-week"
                  label="Laporan mingguan operasional"
                  checked={notif.weeklyReport}
                  onChange={(weeklyReport) =>
                    setNotif((n) => ({ ...n, weeklyReport }))
                  }
                />
                <Switch
                  id="n-overdue"
                  label="Piutang / utang lewat jatuh tempo"
                  checked={notif.overdueAlert}
                  onChange={(overdueAlert) =>
                    setNotif((n) => ({ ...n, overdueAlert }))
                  }
                />
                <Switch
                  id="n-stock"
                  label="Stok di bawah minimum"
                  checked={notif.stockLow}
                  onChange={(stockLow) => setNotif((n) => ({ ...n, stockLow }))}
                />
                <Switch
                  id="n-order"
                  label="Order penjualan baru"
                  checked={notif.newOrder}
                  onChange={(newOrder) => setNotif((n) => ({ ...n, newOrder }))}
                />
                <Switch
                  id="n-pay"
                  label="Pembayaran diterima / dicatat"
                  checked={notif.paymentReceived}
                  onChange={(paymentReceived) =>
                    setNotif((n) => ({ ...n, paymentReceived }))
                  }
                />
                <Switch
                  id="n-weigh"
                  label="Konfirmasi berat gabah menunggu"
                  checked={notif.weighConfirm}
                  onChange={(weighConfirm) =>
                    setNotif((n) => ({ ...n, weighConfirm }))
                  }
                />
                <Switch
                  id="n-push"
                  label="Notifikasi browser (butuh izin perangkat)"
                  checked={notif.browserPush}
                  onChange={(browserPush) =>
                    setNotif((n) => ({ ...n, browserPush }))
                  }
                />
              </SwitchBlock>
            </SectionCard>
          ) : null}

          {tab === 'keamanan' ? (
            <>
              <SectionCard
                title="Ubah kata sandi"
                description="Mock lokal — nanti tersambung Supabase Auth."
                footer={
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!security.currentPassword.trim()) {
                          setPasswordError('Isi kata sandi saat ini')
                          return
                        }
                        if (security.newPassword.length < 8) {
                          setPasswordError('Kata sandi baru minimal 8 karakter')
                          return
                        }
                        if (security.newPassword !== security.confirmPassword) {
                          setPasswordError('Konfirmasi kata sandi tidak cocok')
                          return
                        }
                        setPasswordError(undefined)
                        setSecurity((s) => ({
                          ...s,
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        }))
                        notify('Kata sandi diperbarui (demo)')
                      }}
                      className="h-10 rounded-xl bg-brand-800 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-900"
                    >
                      Perbarui kata sandi
                    </button>
                  </div>
                }
              >
                <TextField
                  id="pw-current"
                  label="Kata sandi saat ini"
                  type="password"
                  autoComplete="current-password"
                  value={security.currentPassword}
                  onChange={(e) => {
                    setSecurity((s) => ({
                      ...s,
                      currentPassword: e.target.value,
                    }))
                    setPasswordError(undefined)
                  }}
                  error={passwordError}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    id="pw-new"
                    label="Kata sandi baru"
                    type="password"
                    autoComplete="new-password"
                    value={security.newPassword}
                    onChange={(e) =>
                      setSecurity((s) => ({
                        ...s,
                        newPassword: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    id="pw-confirm"
                    label="Ulangi kata sandi baru"
                    type="password"
                    autoComplete="new-password"
                    value={security.confirmPassword}
                    onChange={(e) =>
                      setSecurity((s) => ({
                        ...s,
                        confirmPassword: e.target.value,
                      }))
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Keamanan sesi"
                description="Verifikasi tambahan dan kontrol timeout."
                footer={
                  <SaveBar
                    dirty={dirty.security}
                    onReset={() =>
                      setSecurity((s) => ({
                        ...s,
                        ...securityBase,
                      }))
                    }
                    onSave={() => {
                      const next = {
                        twoFactor: security.twoFactor,
                        sessionTimeout: security.sessionTimeout,
                        loginAlert: security.loginAlert,
                      }
                      setSecurityBase(next)
                      saveStored({ security: next })
                      notify('Keamanan sesi disimpan')
                    }}
                  />
                }
              >
                <SwitchBlock>
                  <Switch
                    id="sec-2fa"
                    label="Aktifkan verifikasi 2 langkah (OTP email)"
                    checked={security.twoFactor}
                    onChange={(twoFactor) =>
                      setSecurity((s) => ({ ...s, twoFactor }))
                    }
                  />
                  <Switch
                    id="sec-login"
                    label="Kirim email saat ada login baru"
                    checked={security.loginAlert}
                    onChange={(loginAlert) =>
                      setSecurity((s) => ({ ...s, loginAlert }))
                    }
                  />
                </SwitchBlock>
                <Select
                  label="Timeout sesi tidak aktif"
                  value={security.sessionTimeout}
                  options={[
                    { value: '30', label: '30 menit' },
                    { value: '60', label: '1 jam' },
                    { value: '120', label: '2 jam' },
                    { value: 'never', label: 'Tidak otomatis keluar' },
                  ]}
                  onChange={(sessionTimeout) =>
                    setSecurity((s) => ({ ...s, sessionTimeout }))
                  }
                />
              </SectionCard>

              <BackupDataCard notify={notify} />
            </>
          ) : null}

          {tab === 'sesi' ? (
            <>
              <SectionCard
                title="Perangkat aktif"
                description="Sesi yang sedang masuk (data demo)."
              >
                <ul className="space-y-2">
                  {[
                    {
                      device: 'Chrome · Windows',
                      where: 'Klaten',
                      when: 'Sekarang · perangkat ini',
                      current: true,
                    },
                    {
                      device: 'Safari · iPhone',
                      where: 'Solo',
                      when: '2 hari lalu',
                      current: false,
                    },
                  ].map((row) => (
                    <li
                      key={row.device}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/80 bg-surface/60 px-3.5 py-3"
                    >
                      <div>
                        <p className="text-[13px] font-medium text-ink">
                          {row.device}
                          {row.current ? (
                            <span className="ml-2 text-[11px] font-semibold text-brand-700">
                              Aktif
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted">
                          {row.where} · {row.when}
                        </p>
                      </div>
                      {!row.current ? (
                        <button
                          type="button"
                          onClick={() =>
                            notify(`Sesi ${row.device} diakhiri (demo)`)
                          }
                          className="h-9 rounded-xl border border-line px-3 text-[12.5px] font-medium text-ink transition hover:bg-white"
                        >
                          Akhiri
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard
                title="Keluar akun"
                description="Menghapus sesi lokal di perangkat ini."
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-muted">
                    Masuk sebagai{' '}
                    <span className="font-medium text-ink">{user?.email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={logout}
                    className="h-10 rounded-xl border border-red-200 bg-red-50 px-3.5 text-[13px] font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Keluar
                  </button>
                </div>
              </SectionCard>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
