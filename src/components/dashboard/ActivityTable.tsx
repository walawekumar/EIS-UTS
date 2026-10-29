import type { ActivityRow } from '@/features/dashboard/dashboard-data'

const STATUS_LABEL = {
  ok: 'Selesai',
  warn: 'Tinjau',
  draft: 'Draft',
} as const

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-ink/20 text-[11px] tracking-wide text-muted uppercase">
            <th className="py-2 pr-3 font-medium">Tanggal</th>
            <th className="py-2 pr-3 font-medium">Jenis</th>
            <th className="py-2 pr-3 font-medium">Referensi</th>
            <th className="py-2 pr-3 font-medium">Nilai</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 font-medium">Oleh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.reference}-${row.date}`}
              className="border-b border-line last:border-0"
            >
              <td className="num py-2.5 pr-3 text-muted">{row.date}</td>
              <td className="py-2.5 pr-3 text-ink">{row.type}</td>
              <td className="num py-2.5 pr-3 text-ink">{row.reference}</td>
              <td className="num py-2.5 pr-3 text-ink">{row.amount}</td>
              <td className="py-2.5 pr-3 font-mono text-[12px] text-muted">
                {STATUS_LABEL[row.status]}
              </td>
              <td className="py-2.5 text-muted">{row.actor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
