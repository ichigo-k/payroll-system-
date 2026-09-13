import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

export const BRAND = {
  name: 'PayCompass',
  tagline: 'Payroll for teams in Ghana',
  copyright: `© ${new Date().getFullYear()} PayCompass`,
  colors: {
    brand: '#0C66E4',
    ink: '#172B4D',
  },
} as const

/**
 * Mark geometry on a 32 x 32 grid, shared by the React components and the static SVG files
 * (src/app/icon.svg, public/brand/*.svg). If you change a path here, update those files too.
 *
 * - Tile: rounded square, 25% corner radius (Atlassian app-icon proportions)
 * - Ring: an open "C" for Compass, gap facing north-east
 * - Needle: a kite pointing north-east through the gap; the bold half leads, the soft half trails
 */
export const LOGO_GEOMETRY = {
  viewBox: '0 0 32 32',
  tileRadius: 8,
  ring: 'M24.86 14.44A9 9 0 1 1 17.56 7.14',
  ringWidth: 2.5,
  needleLead: 'M24.5 7.5 18.12 18.12 13.88 13.88Z',
  needleTrail: 'M11.05 20.95 18.12 18.12 13.88 13.88Z',
} as const

export type LogoAppearance = 'brand' | 'inverse' | 'neutral'

const MARK_COLORS: Record<LogoAppearance, { tile: string; glyph: string; trailOpacity: number }> = {
  // Blue tile, white glyph. Default on light surfaces.
  brand: { tile: BRAND.colors.brand, glyph: '#FFFFFF', trailOpacity: 0.55 },
  // White tile, blue glyph. For dark or photo backgrounds.
  inverse: { tile: '#FFFFFF', glyph: BRAND.colors.brand, trailOpacity: 0.45 },
  // No tile, glyph in currentColor. For monochrome contexts (print, watermarks, single-color UI).
  neutral: { tile: 'none', glyph: 'currentColor', trailOpacity: 0.5 },
}

type MarkProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number
  appearance?: LogoAppearance
  /** Accessible name. Omit when the mark sits next to a visible wordmark. */
  title?: string
}

/** The PayCompass app icon on its own. */
export function LogoMark({ size = 32, appearance = 'brand', title, className, ...props }: MarkProps) {
  const colors = MARK_COLORS[appearance]
  const g = LOGO_GEOMETRY
  return (
    <svg
      width={size}
      height={size}
      viewBox={g.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {colors.tile !== 'none' && <rect width="32" height="32" rx={g.tileRadius} fill={colors.tile} />}
      <path d={g.ring} stroke={colors.glyph} strokeWidth={g.ringWidth} strokeLinecap="round" />
      <path d={g.needleTrail} fill={colors.glyph} fillOpacity={colors.trailOpacity} />
      <path d={g.needleLead} fill={colors.glyph} />
    </svg>
  )
}

/** Mark plus wordmark. Wordmark size scales with the mark. */
export function Logo({
  size = 24,
  appearance = 'brand',
  wordmark = true,
  className,
}: {
  size?: number
  appearance?: LogoAppearance
  wordmark?: boolean
  className?: string
}) {
  if (!wordmark) return <LogoMark size={size} appearance={appearance} title={BRAND.name} className={className} />

  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: Math.round(size * 0.35) }}>
      <LogoMark size={size} appearance={appearance} />
      <span
        className={cn('leading-none font-semibold whitespace-nowrap', appearance === 'inverse' ? 'text-white' : 'text-foreground')}
        style={{ fontSize: Math.round(size * 0.66), letterSpacing: '-0.02em' }}
      >
        {BRAND.name}
      </span>
    </span>
  )
}
