/** Pembaca pengaturan aplikasi — dipakai modul lain (tema, prefix, print, dll). */

export type AppSettings = {
  profile: {
    name: string
    email: string
    signatureName: string
    avatarUrl: string
    branch: string
  }
  company: {
    name: string
    brand: string
    legalName: string
    npwp: string
    address: string
    city: string
    phone: string
    email: string
    warehouse: string
    bankName: string
    bankAccount: string
    bankHolder: string
  }
  finance: {
    ppnRate: number
    includePpnDefault: boolean
    paymentTermDays: number
    overdueGraceDays: number
    requireReceiptPay: boolean
    requireReceiptShip: boolean
  }
  stock: {
    valuation: 'fifo' | 'average'
    defaultLocation: string
    lowStockAlert: boolean
    lowStockPct: number
    allowNegative: boolean
    autoConfirmWeigh: boolean
    taraPerSack: number
    varianceTolerance: number
  }
  docs: {
    invoicePrefix: string
    purchasePrefix: string
    orderPrefix: string
    printFooter: string
    showLogo: boolean
    showNpwp: boolean
    showBank: boolean
    showSignature: boolean
    copyCount: number
  }
  prefs: {
    language: 'id' | 'en'
    dateFormat: 'dmy' | 'ymd'
    numberFormat: 'id' | 'en'
    pageSize: number
    density: 'comfortable' | 'compact'
    defaultModule: string
    mode: 'light' | 'dark' | 'system'
    accent: 'green' | 'blue' | 'teal'
    confirmDelete: boolean
    soundFeedback: boolean
  }
  security: {
    twoFactor: boolean
    sessionTimeout: '30' | '60' | '120' | 'never'
    loginAlert: boolean
  }
}

export const SETTINGS_KEY = 'egabah.settings.v2'
export const SETTINGS_EVENT = 'egabah-settings'

const DEFAULTS: AppSettings = {
  profile: {
    name: '',
    email: '',
    signatureName: '',
    avatarUrl: '',
    branch: 'Mill Klaten',
  },
  company: {
    name: 'CV E-Gabah Sejahtera',
    brand: 'E-Gabah',
    legalName: 'CV E-Gabah Sejahtera',
    npwp: '10.0.1.3-012.000',
    address: 'Jl. Raya Penggilingan No. 12, Kawasan Industri Padi',
    city: 'Klaten',
    phone: '(0272) 321-450',
    email: 'ops@e-gabah.id',
    warehouse: 'Gudang Utama A',
    bankName: 'Bank BRI',
    bankAccount: '0123-01-000789-53-2',
    bankHolder: 'CV E-Gabah Sejahtera',
  },
  finance: {
    ppnRate: 11,
    includePpnDefault: false,
    paymentTermDays: 7,
    overdueGraceDays: 3,
    requireReceiptPay: true,
    requireReceiptShip: true,
  },
  stock: {
    valuation: 'average',
    defaultLocation: 'Gudang Utama A',
    lowStockAlert: true,
    lowStockPct: 10,
    allowNegative: false,
    autoConfirmWeigh: false,
    taraPerSack: 0.25,
    varianceTolerance: 5,
  },
  docs: {
    invoicePrefix: 'AR',
    purchasePrefix: 'PB',
    orderPrefix: 'SO',
    printFooter:
      'Terima kasih. Bukti ini sah tanpa tanda tangan basah bila dicetak dari E-Gabah.',
    showLogo: true,
    showNpwp: true,
    showBank: true,
    showSignature: true,
    copyCount: 1,
  },
  prefs: {
    language: 'id',
    dateFormat: 'dmy',
    numberFormat: 'id',
    pageSize: 6,
    density: 'comfortable',
    defaultModule: '/app/dashboard',
    mode: 'light',
    accent: 'green',
    confirmDelete: true,
    soundFeedback: false,
  },
  security: {
    twoFactor: false,
    sessionTimeout: '60',
    loginAlert: true,
  },
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : fallback
}

function parsePageSize(value: unknown): number {
  const n = num(value, 6)
  return n === 10 || n === 20 ? n : 6
}

export function readAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return structuredClone(DEFAULTS)
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>
    const p = parsed.profile ?? {}
    const c = parsed.company ?? {}
    const f = parsed.finance ?? {}
    const s = parsed.stock ?? {}
    const d = parsed.docs ?? {}
    const prefs = parsed.prefs ?? {}
    const sec = parsed.security ?? {}

    return {
      profile: {
        name: String(p.name ?? DEFAULTS.profile.name),
        email: String(p.email ?? DEFAULTS.profile.email),
        signatureName: String(p.signatureName ?? DEFAULTS.profile.signatureName),
        avatarUrl: String(p.avatarUrl ?? DEFAULTS.profile.avatarUrl),
        branch: String(p.branch ?? DEFAULTS.profile.branch),
      },
      company: {
        name: String(c.name ?? DEFAULTS.company.name),
        brand: String(c.brand ?? DEFAULTS.company.brand),
        legalName: String(c.legalName ?? DEFAULTS.company.legalName),
        npwp: String(c.npwp ?? DEFAULTS.company.npwp),
        address: String(c.address ?? DEFAULTS.company.address),
        city: String(c.city ?? DEFAULTS.company.city),
        phone: String(c.phone ?? DEFAULTS.company.phone),
        email: String(c.email ?? DEFAULTS.company.email),
        warehouse: String(c.warehouse ?? DEFAULTS.company.warehouse),
        bankName: String(c.bankName ?? DEFAULTS.company.bankName),
        bankAccount: String(c.bankAccount ?? DEFAULTS.company.bankAccount),
        bankHolder: String(c.bankHolder ?? DEFAULTS.company.bankHolder),
      },
      finance: {
        ppnRate: num(f.ppnRate, DEFAULTS.finance.ppnRate),
        includePpnDefault: Boolean(
          f.includePpnDefault ?? DEFAULTS.finance.includePpnDefault,
        ),
        paymentTermDays: num(f.paymentTermDays, DEFAULTS.finance.paymentTermDays),
        overdueGraceDays: num(
          f.overdueGraceDays,
          DEFAULTS.finance.overdueGraceDays,
        ),
        requireReceiptPay: Boolean(
          f.requireReceiptPay ?? DEFAULTS.finance.requireReceiptPay,
        ),
        requireReceiptShip: Boolean(
          f.requireReceiptShip ?? DEFAULTS.finance.requireReceiptShip,
        ),
      },
      stock: {
        valuation:
          s.valuation === 'fifo' || s.valuation === 'average'
            ? s.valuation
            : DEFAULTS.stock.valuation,
        defaultLocation: String(
          s.defaultLocation ?? DEFAULTS.stock.defaultLocation,
        ),
        lowStockAlert: Boolean(s.lowStockAlert ?? DEFAULTS.stock.lowStockAlert),
        lowStockPct: num(s.lowStockPct, DEFAULTS.stock.lowStockPct),
        allowNegative: Boolean(s.allowNegative ?? DEFAULTS.stock.allowNegative),
        autoConfirmWeigh: Boolean(
          s.autoConfirmWeigh ?? DEFAULTS.stock.autoConfirmWeigh,
        ),
        taraPerSack: num(
          typeof s.taraPerSack === 'string'
            ? s.taraPerSack.replace(',', '.')
            : s.taraPerSack,
          DEFAULTS.stock.taraPerSack,
        ),
        varianceTolerance: num(
          s.varianceTolerance,
          DEFAULTS.stock.varianceTolerance,
        ),
      },
      docs: {
        invoicePrefix: String(d.invoicePrefix ?? DEFAULTS.docs.invoicePrefix),
        purchasePrefix: String(d.purchasePrefix ?? DEFAULTS.docs.purchasePrefix),
        orderPrefix: String(d.orderPrefix ?? DEFAULTS.docs.orderPrefix),
        printFooter: String(d.printFooter ?? DEFAULTS.docs.printFooter),
        showLogo: Boolean(d.showLogo ?? DEFAULTS.docs.showLogo),
        showNpwp: Boolean(d.showNpwp ?? DEFAULTS.docs.showNpwp),
        showBank: Boolean(d.showBank ?? DEFAULTS.docs.showBank),
        showSignature: Boolean(d.showSignature ?? DEFAULTS.docs.showSignature),
        copyCount: Math.min(3, Math.max(1, num(d.copyCount, 1))),
      },
      prefs: {
        language: prefs.language === 'en' ? 'en' : 'id',
        dateFormat: prefs.dateFormat === 'ymd' ? 'ymd' : 'dmy',
        numberFormat: prefs.numberFormat === 'en' ? 'en' : 'id',
        pageSize: parsePageSize(prefs.pageSize),
        density: prefs.density === 'compact' ? 'compact' : 'comfortable',
        defaultModule: String(
          prefs.defaultModule ?? DEFAULTS.prefs.defaultModule,
        ),
        mode:
          prefs.mode === 'dark' || prefs.mode === 'system' || prefs.mode === 'light'
            ? prefs.mode
            : 'light',
        accent:
          prefs.accent === 'blue' || prefs.accent === 'teal' || prefs.accent === 'green'
            ? prefs.accent
            : 'green',
        confirmDelete: Boolean(prefs.confirmDelete ?? DEFAULTS.prefs.confirmDelete),
        soundFeedback: Boolean(
          prefs.soundFeedback ?? DEFAULTS.prefs.soundFeedback,
        ),
      },
      security: {
        twoFactor: Boolean(sec.twoFactor ?? DEFAULTS.security.twoFactor),
        sessionTimeout:
          sec.sessionTimeout === '30' ||
          sec.sessionTimeout === '60' ||
          sec.sessionTimeout === '120' ||
          sec.sessionTimeout === 'never'
            ? sec.sessionTimeout
            : '60',
        loginAlert: Boolean(sec.loginAlert ?? DEFAULTS.security.loginAlert),
      },
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export function notifySettingsChanged() {
  window.dispatchEvent(new Event(SETTINGS_EVENT))
}

export function getPageSize(): number {
  return readAppSettings().prefs.pageSize
}

export function getPaymentTermDays(): number {
  return readAppSettings().finance.paymentTermDays
}

export function getPurchasePrefix(): string {
  return readAppSettings().docs.purchasePrefix || 'PB'
}

export function getOrderPrefix(): string {
  return readAppSettings().docs.orderPrefix || 'SO'
}

export function getInvoicePrefix(): string {
  return readAppSettings().docs.invoicePrefix || 'AR'
}
