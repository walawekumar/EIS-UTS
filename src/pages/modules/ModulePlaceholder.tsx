type ModulePlaceholderProps = {
  moduleName: string
  notes: string[]
}

export function ModulePlaceholder({ moduleName, notes }: ModulePlaceholderProps) {
  return (
    <div>
      <p className="text-sm text-muted">
        Halaman <span className="font-medium text-ink">{moduleName}</span> siap
        dikembangkan. Struktur routing dan shell UI sudah aktif.
      </p>

      <ul className="mt-4 space-y-2">
        {notes.map((note) => (
          <li
            key={note}
            className="rounded-md border border-line bg-brand-50/60 px-3 py-2 text-sm text-brand-900"
          >
            {note}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-muted">
        Integrasi data/transaksi akan disambungkan ke Supabase pada tahap berikutnya.
      </p>
    </div>
  )
}
