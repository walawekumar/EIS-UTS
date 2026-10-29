import { useAuth } from '@/features/auth/AuthContext'

function greetingByHour(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** Sambutan singkat — disesuaikan jam agar terasa personal */
function welcomeByHour(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return 'Semoga langkah pagi ini membawa hasil yang baik.'
  if (hour < 15) return 'Selamat datang kembali — fokuskan yang penting hari ini.'
  if (hour < 18) return 'Tetap semangat; setiap keputusan hari ini berharga.'
  return 'Terima kasih sudah menyelesaikan hari dengan baik.'
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
    <section className="flex items-center gap-4 rounded-2xl border border-brand-200/80 bg-brand-800 px-4 py-4 text-white sm:gap-5 sm:px-5 sm:py-5">
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[17px] font-semibold ring-2 ring-white/20 sm:size-14 sm:text-[19px]"
        aria-hidden
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[18px] font-semibold tracking-tight sm:text-[20px]">
          {greetingByHour()}, {name}
        </h2>
        <p className="mt-1 truncate text-[13px] leading-snug text-brand-100/90 sm:text-[14px]">
          {welcomeByHour()}
        </p>
      </div>

      <p className="hidden shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-[12px] text-brand-50 capitalize sm:block">
        {formatMonthYear()}
      </p>
    </section>
  )
}
