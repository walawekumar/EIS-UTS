import { getSupabase } from '@/lib/supabase-client'
import type { MasterUser } from '@/features/master/master-data'
import type { MasterSnapshot } from '@/features/master/master-storage'
import {
  authUserFromProfile,
  partnerFromRow,
  partnerToRow,
  productFromRow,
  productToRow,
  userFromProfile,
  type PartnerRow,
  type ProductRow,
  type ProfileRow,
} from '@/features/master/master-db-map'

export { authUserFromProfile }

export function mapSupabaseError(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (code === '42501' || /permission|row-level security/i.test(msg)) {
    return 'Tidak punya izin (RLS).'
  }
  return msg || 'Gagal menyimpan ke cloud.'
}

export async function loadProfileByUserId(userId: string): Promise<ProfileRow> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await sb
    .from('profiles')
    .select('id, email, name, role, title, phone, branch, department, active')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Profil pengguna tidak ditemukan.')
  return data as ProfileRow
}

export async function loadMasterCloud(): Promise<MasterSnapshot> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')

  const [partnersRes, productsRes, profilesRes] = await Promise.all([
    sb.from('partners').select('*'),
    sb.from('products').select('*'),
    sb
      .from('profiles')
      .select('id, email, name, role, title, phone, branch, department, active'),
  ])

  if (partnersRes.error) throw partnersRes.error
  if (productsRes.error) throw productsRes.error
  if (profilesRes.error) throw profilesRes.error

  const partners = (partnersRes.data as PartnerRow[]).map(partnerFromRow)
  const products = (productsRes.data as ProductRow[]).map(productFromRow)
  const users = (profilesRes.data as ProfileRow[]).map(userFromProfile)

  return {
    version: 1,
    suppliers: partners.filter((p) => p.kind === 'supplier'),
    customers: partners.filter((p) => p.kind === 'customer'),
    products,
    users,
    updatedAt: new Date().toISOString(),
  }
}

export async function saveMasterCloud(snap: MasterSnapshot): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')

  const partnerRows = [...snap.suppliers, ...snap.customers].map(partnerToRow)
  const productRows = snap.products.map(productToRow)

  if (partnerRows.length) {
    const { error } = await sb.from('partners').upsert(partnerRows)
    if (error) throw error
  }
  if (productRows.length) {
    const { error } = await sb.from('products').upsert(productRows)
    if (error) throw error
  }

  const { data: existingPartners, error: ep } = await sb
    .from('partners')
    .select('id')
  if (ep) throw ep
  const existingPartnerIds = (existingPartners ?? []).map((r) => r.id as string)
  if (partnerRows.length === 0 && existingPartnerIds.length > 0) {
    throw new Error(
      'Menolak hapus semua partners — payload kosong sementara remote masih berisi data.',
    )
  }
  const keepP = new Set(partnerRows.map((r) => r.id))
  const dropP = existingPartnerIds.filter((id) => !keepP.has(id))
  if (dropP.length) {
    const { error } = await sb.from('partners').delete().in('id', dropP)
    if (error) throw error
  }

  const { data: existingProducts, error: epr } = await sb
    .from('products')
    .select('id')
  if (epr) throw epr
  const existingProductIds = (existingProducts ?? []).map((r) => r.id as string)
  if (productRows.length === 0 && existingProductIds.length > 0) {
    throw new Error(
      'Menolak hapus semua products — payload kosong sementara remote masih berisi data.',
    )
  }
  const keepPr = new Set(productRows.map((r) => r.id))
  const dropPr = existingProductIds.filter((id) => !keepPr.has(id))
  if (dropPr.length) {
    const { error } = await sb.from('products').delete().in('id', dropPr)
    if (error) throw error
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function updateProfileUser(user: MasterUser): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi.')
  if (!UUID_RE.test(user.id)) {
    throw new Error(
      'Pengguna baru harus dibuat di Supabase Auth terlebih dahulu.',
    )
  }
  const { error } = await sb
    .from('profiles')
    .update({
      name: user.name,
      email: user.email.trim().toLowerCase(),
      role: user.role,
      title: user.title,
      phone: user.phone,
      branch: user.branch,
      department: user.department,
      active: user.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) throw error
}
