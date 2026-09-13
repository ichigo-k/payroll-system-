import { cn } from '@/lib/utils'

type Appearance = 'default' | 'inprogress' | 'success' | 'moved' | 'removed'

// Atlassian lozenge appearances: subtle background, bold uppercase label
const APPEARANCES: Record<Appearance, string> = {
  default: 'bg-secondary text-secondary-foreground',
  inprogress: 'bg-accent text-primary-strong',
  success: 'bg-success-soft text-success',
  moved: 'bg-warning-soft text-warning',
  removed: 'bg-danger-soft text-danger',
}

const STATUS: Record<string, { label: string; appearance: Appearance }> = {
  // Employment
  ACTIVE: { label: 'Active', appearance: 'success' },
  INACTIVE: { label: 'Inactive', appearance: 'default' },
  SUSPENDED: { label: 'Suspended', appearance: 'moved' },
  TERMINATED: { label: 'Terminated', appearance: 'removed' },
  // Access
  INVITED: { label: 'Invited', appearance: 'inprogress' },
  DEACTIVATED: { label: 'Deactivated', appearance: 'removed' },
  NO_ACCESS: { label: 'No access', appearance: 'default' },
  SIGNED_IN: { label: 'Signed in', appearance: 'success' },
  AVAILABLE: { label: 'Available', appearance: 'inprogress' },
  BLOCKED: { label: 'Blocked', appearance: 'removed' },
  PENDING_APPROVAL: { label: 'Changes pending', appearance: 'moved' },
  AWAITING_ACTIVATION: { label: 'Awaiting activation', appearance: 'moved' },
  // Payroll runs
  DRAFT: { label: 'Draft', appearance: 'default' },
  SUBMITTED: { label: 'In review', appearance: 'moved' },
  APPROVED: { label: 'Approved', appearance: 'inprogress' },
  REJECTED: { label: 'Rejected', appearance: 'removed' },
  PAID: { label: 'Paid', appearance: 'success' },
  // Exports
  EXPORT_PENDING: { label: 'Preparing', appearance: 'inprogress' },
  EXPORT_READY: { label: 'Ready', appearance: 'success' },
  EXPORT_DOWNLOADED: { label: 'Downloaded', appearance: 'default' },
  EXPORT_FAILED: { label: 'Failed', appearance: 'removed' },
  EXPORT_EXPIRED: { label: 'Expired', appearance: 'default' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { label, appearance } = STATUS[status] ?? { label: status, appearance: 'default' as Appearance }
  return (
    <span
      className={cn(
        'inline-flex h-4 max-w-full items-center rounded-[3px] px-1 text-[11px] leading-none font-bold tracking-wide whitespace-nowrap uppercase',
        APPEARANCES[appearance],
        className,
      )}
    >
      {label}
    </span>
  )
}
