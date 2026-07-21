import type { SVGProps } from 'react'

export const BRAND = {
  name: 'PayCompass',
  tagline: 'Payroll · reimagined',
  copyright: `© ${new Date().getFullYear()} PayCompass`,
} as const

export function Logo({
  size = 28,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PayCompass logo"
      role="img"
      {...props}
    >
      <defs>
        <linearGradient id="pc-tile" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F1720" />
          <stop offset="100%" stopColor="#1B2532" />
        </linearGradient>
        <linearGradient id="pc-needle-n" x1="16" y1="4" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5CE5A" />
          <stop offset="100%" stopColor="#C9A227" />
        </linearGradient>
        <linearGradient id="pc-needle-s" x1="16" y1="16" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B4657" />
          <stop offset="100%" stopColor="#252E3B" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="7" fill="url(#pc-tile)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#2A3546" strokeOpacity="0.6" />
      <path d="M16 4 L19.2 16 L16 16 Z" fill="url(#pc-needle-n)" />
      <path d="M16 4 L12.8 16 L16 16 Z" fill="#E5B93E" opacity="0.75" />
      <path d="M16 28 L12.8 16 L16 16 Z" fill="url(#pc-needle-s)" />
      <path d="M16 28 L19.2 16 L16 16 Z" fill="#4B5769" opacity="0.9" />
      <circle cx="16" cy="16" r="1.6" fill="#F5CE5A" />
      <circle cx="16" cy="16" r="0.6" fill="#0F1720" />
    </svg>
  )
}

export function LogoMono({ size = 24, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PayCompass mark"
      role="img"
      {...props}
    >
      <path d="M16 3 L20 16 L16 16 Z" fill="currentColor" />
      <path d="M16 3 L12 16 L16 16 Z" fill="currentColor" opacity="0.55" />
      <path d="M16 29 L12 16 L16 16 Z" fill="currentColor" opacity="0.35" />
      <path d="M16 29 L20 16 L16 16 Z" fill="currentColor" opacity="0.5" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    </svg>
  )
}
