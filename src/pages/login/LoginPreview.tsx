export function LoginPreview() {
  return (
    <div className="relative flex h-full min-h-[560px] flex-col justify-between overflow-hidden rounded-b-[18px] bg-brand-900 p-8 text-white lg:rounded-none lg:rounded-r-[18px] xl:p-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 70% 0%, rgba(79,181,124,0.22), transparent 55%), radial-gradient(ellipse 60% 45% at 10% 90%, rgba(22,90,56,0.55), transparent 50%), linear-gradient(160deg, #0c1f14 0%, #123524 42%, #165a38 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative">
        <div className="mb-8 inline-flex size-12 items-center justify-center rounded-[12px] bg-white/12 ring-1 ring-white/20">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 21c7-3 9-9 8-15-6-1-12 2-15 8 3 1 5.5 3.5 7 7Z" />
            <path d="M9 14c2-1.5 4.5-2.5 7.5-3" />
          </svg>
        </div>

        {/* Floating preview cards */}
        <div className="relative mx-auto h-[280px] w-full max-w-[360px]">
          <article className="absolute top-0 left-0 z-20 w-[220px] rotate-[-4deg] rounded-[14px] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
            <p className="text-[11px] font-medium tracking-wide text-brand-200">
              Stok Gabah
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">12.480 kg</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-[72%] rounded-full bg-brand-400" />
            </div>
            <p className="mt-2 text-[11px] text-brand-100/75">Kapasitas gudang 72%</p>
          </article>

          <article className="absolute top-16 right-0 z-10 w-[210px] rotate-[3deg] rounded-[14px] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
            <p className="text-[11px] font-medium tracking-wide text-brand-200">
              Batch Produksi
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-2xl font-semibold tracking-tight">8</span>
              <span className="pb-1 text-xs text-brand-100/70">aktif hari ini</span>
            </div>
            <div className="mt-3 flex gap-1">
              {[40, 70, 55, 85, 60, 90, 48].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-brand-400/80"
                  style={{ height: `${h * 0.35}px` }}
                />
              ))}
            </div>
          </article>

          <article className="absolute bottom-0 left-8 z-30 w-[240px] rounded-[14px] border border-white/15 bg-[#0f2a1c]/92 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-wide text-brand-200">
                Penjualan Hari Ini
              </p>
              <span className="rounded-md bg-brand-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">
                +12%
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">Rp 18,4 jt</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-brand-100/80">
                <span>Beras premium</span>
                <span>62%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[62%] rounded-full bg-brand-300" />
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="relative mt-10 max-w-md">
        <h2 className="font-display text-[1.75rem] leading-snug font-semibold tracking-tight xl:text-[2rem]">
          Satu portal untuk operasi penggilingan yang lebih tertib.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-brand-100/80">
          Pantau pembelian gabah, batch giling, stok, penjualan, dan kas dalam satu
          alur kerja yang saling terhubung.
        </p>
        <div className="mt-6 flex gap-1.5">
          <span className="h-1 w-8 rounded-full bg-white" />
          <span className="h-1 w-3 rounded-full bg-white/35" />
          <span className="h-1 w-3 rounded-full bg-white/35" />
        </div>
      </div>
    </div>
  )
}
