const MODULES = [
  {
    title: 'E-Gabah',
    detail: 'Pembelian, produksi, stok, penjualan, dan keuangan',
  },
  {
    title: 'E-Absensi',
    detail: 'Check-in, check-out, dan pengajuan cuti',
  },
  {
    title: 'E-HR',
    detail: 'Persetujuan cuti, rekap, dan persiapan gaji',
  },
]

export function LoginPreview() {
  return (
    <div className="flex h-full min-h-[560px] flex-col justify-between bg-brand-800 p-8 text-white lg:rounded-none lg:rounded-r-2xl xl:p-10">
      <div>
        <p className="text-[12px] font-medium text-white/70">Modul</p>
        <ul className="mt-4 divide-y divide-white/15 border-y border-white/15">
          {MODULES.map((item) => (
            <li key={item.title} className="py-3.5">
              <p className="text-[14px] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/70">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 max-w-md">
        <h2 className="text-[22px] leading-snug font-semibold tracking-tight">
          Satu portal untuk operasi penggilingan.
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-white/75">
          Pembelian gabah, batch giling, stok, penjualan, dan kas berada dalam
          alur yang sama.
        </p>
      </div>
    </div>
  )
}
