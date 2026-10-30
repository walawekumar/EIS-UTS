function getPageItems(current: number, total: number): Array<number | '…'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const items: Array<number | '…'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push('…')
  for (let p = start; p <= end; p += 1) items.push(p)
  if (end < total - 1) items.push('…')
  items.push(total)
  return items
}

type FinancePagerProps = {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function FinancePager({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: FinancePagerProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const items = getPageItems(page, pageCount)

  return (
    <div className="mt-3.5 w-full border-t border-line/70 pt-3">
      <p className="mb-2.5 text-[12px] text-muted">
        {total === 0
          ? 'Menampilkan 0 dari 0 entri'
          : `Menampilkan ${from}–${to} dari ${total} entri`}
      </p>

      {pageCount > 1 ? (
        <div className="flex w-full items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sebelumnya
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1">
            {items.map((item, index) =>
              item === '…' ? (
                <span
                  key={`e-${index}`}
                  className="flex size-8 items-center justify-center font-mono text-[13px] text-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={[
                    'flex size-8 items-center justify-center rounded-xl font-mono text-[12px] transition',
                    item === page
                      ? 'bg-brand-800 font-semibold text-white'
                      : 'border border-line text-ink hover:bg-brand-50',
                  ].join(' ')}
                >
                  {item}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      ) : null}
    </div>
  )
}
