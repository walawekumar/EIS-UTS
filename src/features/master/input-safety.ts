/** Sanitasi & validasi input master data (client-side MVP). */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const HTML_TAG = /[<>]/g
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const PHONE_RE = /^(?:\+62|62|0)[\d\s\-()]{8,16}$/
const NPWP_RE = /^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/
const POSTAL_RE = /^\d{5}$/
const BARCODE_RE = /^[\d]{8,14}$/

export function sanitizeText(raw: string, max = 200): string {
  return raw.replace(CONTROL_CHARS, '').replace(HTML_TAG, '').slice(0, max)
}

export function sanitizeMultiline(raw: string, max = 500): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(HTML_TAG, '')
    .replace(/\r\n/g, '\n')
    .slice(0, max)
}

export function sanitizePhone(raw: string): string {
  return raw.replace(/[^\d+\-\s()]/g, '').slice(0, 20)
}

export function sanitizeDigits(raw: string, max = 3): string {
  return raw.replace(/\D/g, '').slice(0, max)
}

export function sanitizeMoney(raw: string, max = 15): string {
  return raw.replace(/\D/g, '').slice(0, max)
}

export function sanitizeEmail(raw: string): string {
  return raw.replace(CONTROL_CHARS, '').replace(/\s/g, '').slice(0, 120)
}

export function sanitizeNpwp(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 15)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 9)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12)}`
}

export function sanitizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 14)
}

export function sanitizeSku(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(HTML_TAG, '')
    .replace(/[^A-Za-z0-9\-_/]/g, '')
    .toUpperCase()
    .slice(0, 32)
}

export type PartnerFieldErrors = Partial<{
  name: string
  legalName: string
  group: string
  area: string
  postalCode: string
  phone: string
  email: string
  contactName: string
  contactPhone: string
  npwp: string
  bankName: string
  bankAccount: string
  bankHolder: string
  paymentTermDays: string
  creditLimit: string
  address: string
  note: string
}>

export function validatePartnerForm(input: {
  name: string
  legalName: string
  group: string
  area: string
  postalCode: string
  phone: string
  email: string
  contactName: string
  contactPhone: string
  npwp: string
  bankName: string
  bankAccount: string
  bankHolder: string
  paymentTermDays: string
  creditLimit: string
  address: string
  note: string
}): PartnerFieldErrors {
  const errors: PartnerFieldErrors = {}
  const name = input.name.trim()
  const legalName = input.legalName.trim()
  const group = input.group.trim()
  const area = input.area.trim()
  const postal = input.postalCode.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()
  const contactPhone = input.contactPhone.trim()
  const npwp = input.npwp.trim()
  const term = input.paymentTermDays.trim()
  const credit = input.creditLimit.trim()
  const address = input.address.trim()
  const note = input.note.trim()

  if (!name) errors.name = 'Nama wajib diisi'
  else if (name.length < 2) errors.name = 'Nama minimal 2 karakter'
  else if (name.length > 120) errors.name = 'Nama maksimal 120 karakter'

  if (legalName && legalName.length > 120)
    errors.legalName = 'Nama legal maksimal 120 karakter'

  if (!group) errors.group = 'Segmen / kelompok wajib dipilih'

  if (area && area.length > 80) errors.area = 'Area maksimal 80 karakter'

  if (postal) {
    if (!POSTAL_RE.test(postal)) errors.postalCode = 'Kode pos harus 5 digit'
  }

  if (phone) {
    if (!PHONE_RE.test(phone)) {
      errors.phone = 'Format telepon tidak valid (contoh: 0812-3456-7890)'
    }
  }

  if (contactPhone) {
    if (!PHONE_RE.test(contactPhone)) {
      errors.contactPhone = 'Format telepon PIC tidak valid'
    }
  }

  if (email) {
    if (!EMAIL_RE.test(email)) {
      errors.email = 'Format email tidak valid'
    }
  }

  if (npwp) {
    if (!NPWP_RE.test(npwp)) {
      errors.npwp = 'Format NPWP: 10.20.0.1-000.000'
    }
  }

  if (input.bankAccount.trim() && !input.bankName.trim()) {
    errors.bankName = 'Isi nama bank jika nomor rekening diisi'
  }
  if (input.bankName.trim() && !input.bankAccount.trim()) {
    errors.bankAccount = 'Isi nomor rekening jika bank diisi'
  }
  if (input.bankAccount.trim().length > 32) {
    errors.bankAccount = 'Nomor rekening terlalu panjang'
  }

  if (!term) {
    errors.paymentTermDays = 'Tempo bayar wajib diisi (0 = tunai)'
  } else {
    const n = Number(term)
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      errors.paymentTermDays = 'Tempo harus angka 0–365 hari'
    }
  }

  if (credit) {
    const n = Number(credit)
    if (!Number.isFinite(n) || n < 0) {
      errors.creditLimit = 'Limit kredit harus angka ≥ 0'
    }
  }

  if (address.length > 300) errors.address = 'Alamat maksimal 300 karakter'
  if (note.length > 300) errors.note = 'Catatan maksimal 300 karakter'
  if (input.contactName.trim().length > 80)
    errors.contactName = 'Nama PIC maksimal 80 karakter'
  if (input.bankHolder.trim().length > 80)
    errors.bankHolder = 'Nama pemilik rekening maksimal 80 karakter'

  return errors
}

export type ProductFieldErrors = Partial<{
  sku: string
  name: string
  barcode: string
  defaultPrice: string
  costPrice: string
  minQty: string
  note: string
}>

export function validateProductForm(input: {
  sku: string
  name: string
  barcode: string
  defaultPrice: string
  costPrice: string
  minQty: string
  note: string
}): ProductFieldErrors {
  const errors: ProductFieldErrors = {}
  const sku = input.sku.trim()
  const name = input.name.trim()
  const barcode = input.barcode.trim()
  const note = input.note.trim()

  if (!sku) errors.sku = 'SKU wajib diisi'
  else if (sku.length < 2) errors.sku = 'SKU minimal 2 karakter'
  else if (sku.length > 32) errors.sku = 'SKU maksimal 32 karakter'

  if (!name) errors.name = 'Nama wajib diisi'
  else if (name.length < 2) errors.name = 'Nama minimal 2 karakter'
  else if (name.length > 120) errors.name = 'Nama maksimal 120 karakter'

  if (barcode && !BARCODE_RE.test(barcode)) {
    errors.barcode = 'Barcode harus 8–14 digit'
  }

  const price = Number(input.defaultPrice.replace(/\D/g, '') || '0')
  if (!Number.isFinite(price) || price < 0) {
    errors.defaultPrice = 'Harga jual tidak valid'
  }

  const cost = Number(input.costPrice.replace(/\D/g, '') || '0')
  if (!Number.isFinite(cost) || cost < 0) {
    errors.costPrice = 'Harga beli tidak valid'
  }

  const minQty = Number(input.minQty.replace(/\D/g, '') || '0')
  if (!Number.isFinite(minQty) || minQty < 0) {
    errors.minQty = 'Stok minimum tidak valid'
  }

  if (note.length > 300) errors.note = 'Catatan maksimal 300 karakter'

  return errors
}

export type UserFieldErrors = Partial<{
  name: string
  email: string
  title: string
  phone: string
  branch: string
  department: string
}>

export function validateUserForm(input: {
  name: string
  email: string
  title: string
  phone: string
  branch: string
  department: string
}): UserFieldErrors {
  const errors: UserFieldErrors = {}
  const name = input.name.trim()
  const email = input.email.trim()
  const phone = input.phone.trim()

  if (!name) errors.name = 'Nama wajib diisi'
  else if (name.length < 2) errors.name = 'Nama minimal 2 karakter'

  if (!email) errors.email = 'Email wajib diisi'
  else if (!EMAIL_RE.test(email)) errors.email = 'Format email tidak valid'

  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = 'Format telepon tidak valid'
  }

  if (input.title.trim().length > 80) errors.title = 'Jabatan maksimal 80 karakter'
  if (input.branch.trim().length > 80) errors.branch = 'Cabang maksimal 80 karakter'
  if (input.department.trim().length > 80)
    errors.department = 'Departemen maksimal 80 karakter'

  return errors
}
