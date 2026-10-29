import type { ReactNode } from 'react'
import type { AppModule } from '@/features/portal/modules'

type IconProps = { className?: string }

function Svg({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function ModuleIcon({
  name,
  className = 'size-7',
}: {
  name: AppModule['icon']
  className?: string
}) {
  switch (name) {
    case 'dashboard':
      return (
        <Svg className={className}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </Svg>
      )
    case 'master':
      return (
        <Svg className={className}>
          <path d="M4 19V5a1 1 0 0 1 1-1h7l2 2h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
          <path d="M8 13h8M8 16h5" />
        </Svg>
      )
    case 'buy':
      return (
        <Svg className={className}>
          <path d="M3 7h13l2 10H6L3 7Z" />
          <path d="M7 7V5a2 2 0 0 1 2-2h4" />
          <circle cx="9" cy="20" r="1" />
          <circle cx="16" cy="20" r="1" />
        </Svg>
      )
    case 'stock':
      return (
        <Svg className={className}>
          <path d="M4 7h16v12H4z" />
          <path d="M4 11h16M9 7V4h6v3" />
        </Svg>
      )
    case 'mill':
      return (
        <Svg className={className}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </Svg>
      )
    case 'sell':
      return (
        <Svg className={className}>
          <path d="M4 7h2l2.5 10h9L20 9H8" />
          <circle cx="10" cy="20" r="1" />
          <circle cx="16" cy="20" r="1" />
        </Svg>
      )
    case 'finance':
      return (
        <Svg className={className}>
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="M3 10h18M8 15h3" />
        </Svg>
      )
    default: {
      const _exhaustive: never = name
      return _exhaustive
    }
  }
}
