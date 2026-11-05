export function LoginPreview() {
  return (
    <div className="relative h-full min-h-[560px] overflow-hidden lg:rounded-r-2xl">
      <img
        src="/login-sawah.jpg"
        alt="Sawah terasering di Tegallalang, Bali"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="motion-rise relative flex h-full min-h-[560px] flex-col justify-end px-8 py-8 xl:px-10 xl:py-10">
        <p className="text-[12px] font-medium tracking-wide text-white/75">
          E-Gabah
        </p>
        <p className="mt-2 max-w-[16rem] text-[26px] leading-[1.2] font-semibold tracking-tight text-white">
          Satu portal untuk operasi penggilingan.
        </p>
        <p className="mt-3 max-w-[18rem] text-[13px] leading-relaxed text-white/80">
          Pembelian, giling, stok, penjualan, dan kas dalam satu alur.
        </p>
        <p className="mt-6 text-[11px] text-white/55">
          Sawah Tegallalang · Christophe95 · CC BY-SA 4.0
        </p>
      </div>
    </div>
  )
}
