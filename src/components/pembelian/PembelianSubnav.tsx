import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import {
  PEMBELIAN_BASE,
  usePembelian,
  type PembelianSection,
} from '@/features/pembelian/PembelianContext'
import { summarize } from '@/features/pembelian/pembelian-data'

/** Stepper alur pembelian: 01 Pencatatan → 02 Penerimaan → 03 Pembayaran. */
export function PembelianSubnav() {
  const { purchases } = usePembelian()

  const steps: {
    id: PembelianSection
    label: string
    path: string
    end?: boolean
    count: number
    hint: string
  }[] = [
    {
      id: 'pencatatan',
      label: 'Pencatatan pembelian',
      path: PEMBELIAN_BASE,
      end: true,
      count: purchases.length,
      hint: 'dokumen dicatat',
    },
    {
      id: 'penerimaan',
      label: 'Penerimaan & konfirmasi berat',
      path: `${PEMBELIAN_BASE}/penerimaan`,
      count: purchases.filter((p) => p.stage !== 'diterima').length,
      hint: 'perlu ditimbang/dikonfirmasi',
    },
    {
      id: 'pembayaran',
      label: 'Pembayaran pemasok',
      path: `${PEMBELIAN_BASE}/pembayaran`,
      count: purchases.filter((p) => summarize(p).outstanding > 0).length,
      hint: 'tagihan belum lunas',
    },
  ]

  return (
    <nav
      aria-label="Alur pembelian gabah"
      className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-panel p-1.5"
    >
      {steps.map((step, i) => (
        <Fragment key={step.id}>
          {i > 0 ? (
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted/50" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          ) : null}
          <NavLink
            to={step.path}
            end={step.end}
            className={({ isActive }) =>
              [
                'group flex min-w-max flex-1 items-center gap-2.5 rounded-xl px-3 py-2 transition',
                isActive ? 'bg-brand-50' : 'hover:bg-surface',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex size-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold transition',
                    isActive ? 'bg-brand-800 text-white' : 'bg-surface text-muted group-hover:text-ink',
                  ].join(' ')}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={[
                    'text-[13px] whitespace-nowrap',
                    isActive ? 'font-semibold text-brand-900' : 'font-medium text-ink/80',
                  ].join(' ')}
                >
                  {step.label}
                </span>
                <span
                  title={`${step.count} ${step.hint}`}
                  className={[
                    'num ml-auto rounded-md px-1.5 text-[11px] leading-5',
                    isActive ? 'bg-brand-100 text-brand-900' : 'bg-surface text-muted',
                  ].join(' ')}
                >
                  {step.count}
                </span>
              </>
            )}
          </NavLink>
        </Fragment>
      ))}
    </nav>
  )
}
