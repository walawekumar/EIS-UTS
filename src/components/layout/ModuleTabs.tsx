import { NavLink } from 'react-router-dom'

export type ModuleTab = {
  to: string
  label: string
  end?: boolean
}

export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  return (
    <nav
      aria-label="Sub halaman"
      className="scrollbar-none mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-line/80 bg-panel p-1 shadow-[0_1px_2px_rgba(20,32,25,0.04)]"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            [
              'shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition',
              isActive
                ? 'bg-brand-800 text-white shadow-sm'
                : 'text-ink/70 hover:bg-brand-50 hover:text-brand-900',
            ].join(' ')
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
