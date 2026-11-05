import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...props,
  }
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-4.1 4.8" />
      <path d="M6.1 6.1A17.5 17.5 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.9" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  )
}

export function UserBadgeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" />
    </svg>
  )
}

/** Butir gabah — tanda aplikasi. */
export function GabahMarkIcon(props: IconProps) {
  return (
    <svg {...base({ ...props, strokeWidth: 1.7 })}>
      <path d="M12 3.8c2.4 2.6 3.5 5.6 3.5 8.7 0 3.8-1.5 6.8-3.5 8.7-2-1.9-3.5-4.9-3.5-8.7 0-3.1 1.1-6.1 3.5-8.7Z" />
      <path d="M12 8.2v11.2" />
    </svg>
  )
}

export function LeafMarkIcon(props: IconProps) {
  return (
    <svg {...base({ ...props, strokeWidth: 1.6 })}>
      <path d="M12 21c7-3 9-9 8-15-6-1-12 2-15 8 3 1 5.5 3.5 7 7Z" />
      <path d="M9 14c2-1.5 4.5-2.5 7.5-3" />
    </svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.6A1.5 1.5 0 0 1 10.5 4h3a1.5 1.5 0 0 1 1.2.4L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.25" />
    </svg>
  )
}
