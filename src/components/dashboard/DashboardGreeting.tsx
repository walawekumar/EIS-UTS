import { useAuth } from '@/features/auth/AuthContext'

function greetingByHour(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function formatMonthYear(date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function DashboardGreeting() {
  const { user } = useAuth()
  const name = user?.name ?? 'Pengguna'
  const initial = name.charAt(0).toUpperCase()

  return (
    <section className="flex items-center gap-3.5 rounded-2xl border border-brand-200/80 bg-brand-800 px-4 py-3.5 text-white sm:gap-4 sm:px-5">
      <div
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[15px] font-semibold ring-2 ring-white/20"
        aria-hidden
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[16px] font-semibold tracking-tight sm:text-[17px]">
          {greetingByHour()}, {name}
        </h2>
        <p className="mt-0.5 truncate text-[12px] text-brand-100/85">
          {user?.roleLabel ?? 'Pengguna'} · pantau operasional hari ini
        </p>
      </div>

      <p className="hidden shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-[12px] text-brand-50 capitalize sm:block">
        {formatMonthYear()}
      </p>
    </section>
  )
}
