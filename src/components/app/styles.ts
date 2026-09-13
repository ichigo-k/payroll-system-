/**
 * Shared Atlassian-style class recipes. Keep buttons, fields and links consistent across pages.
 */

const buttonBase =
  'pressable inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export const button = {
  /** Blue, one per view for the main action */
  primary: `${buttonBase} bg-primary text-primary-foreground hover:bg-primary-strong active:bg-brand-deep`,
  /** Neutral filled, for secondary actions */
  default: `${buttonBase} bg-secondary text-secondary-foreground hover:bg-[#dcdfe4] hover:text-foreground`,
  /** Transparent until hovered, for low-emphasis actions and toolbars */
  subtle: `${buttonBase} bg-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground`,
  /** Square icon-only subtle button */
  icon: 'pressable inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-secondary-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
}

export const field =
  'h-8 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-subtlest hover:bg-muted focus:border-ring focus:bg-card focus:shadow-[inset_0_0_0_1px_var(--ring)] focus:outline-none disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-subtlest aria-invalid:border-danger'

export const link = 'font-medium text-primary hover:underline underline-offset-2'
