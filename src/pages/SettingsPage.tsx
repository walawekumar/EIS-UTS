import { useAuth } from '@/features/auth/AuthContext'

export function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-lg border border-line bg-panel p-5">
      <h2 className="text-[15px] font-semibold text-ink">Pengaturan akun</h2>
      <p className="mt-1 text-[13px] text-muted">
        Profil dasar. Autentikasi Supabase menyusul.
      </p>

      <dl className="mt-5 divide-y divide-line border-t border-line text-[13px]">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">Nama</dt>
          <dd className="font-medium text-ink">{user?.name}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">Email</dt>
          <dd className="font-medium text-ink">{user?.email}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">Peran</dt>
          <dd className="font-medium text-ink">{user?.roleLabel}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">ID</dt>
          <dd className="num font-medium text-ink">{user?.id}</dd>
        </div>
      </dl>
    </div>
  )
}
