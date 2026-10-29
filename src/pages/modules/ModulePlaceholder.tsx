type ModulePlaceholderProps = {
  moduleName: string
  notes: string[]
}

export function ModulePlaceholder({ moduleName, notes }: ModulePlaceholderProps) {
  return (
    <div>
      <p className="text-[13px] text-muted">
        Modul <span className="font-medium text-ink">{moduleName}</span> belum
        diisi transaksi. Struktur halaman sudah siap.
      </p>

      <ul className="mt-4 divide-y divide-line border-t border-b border-line">
        {notes.map((note, index) => (
          <li key={note} className="flex gap-3 py-2.5 text-[13px] text-ink">
            <span className="num w-5 shrink-0 text-muted">
              {String(index + 1).padStart(2, '0')}
            </span>
            {note}
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-[11px] text-muted">
        Data transaksi → Supabase (tahap berikutnya)
      </p>
    </div>
  )
}
