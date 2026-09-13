/**
 * Pure payroll workflow rules (maker-checker). Server actions gather facts and call these.
 *
 * Draft -> Submitted -> Approved -> Paid
 *   Submitted -> Draft  (preparer recalls, or an approver requests changes)
 */

export type RunStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID'

export function checkSubmit({ status, headcount, hasActiveTax }: { status: RunStatus; headcount: number; hasActiveTax: boolean }) {
  if (status !== 'DRAFT') return 'Only draft runs can be submitted.'
  if (headcount === 0) return 'This run has no employees. Add salaries, then recalculate.'
  if (!hasActiveTax) return 'There’s no approved tax configuration for this period.'
  return null
}

export function checkRecall({ status, approvalsThisRound }: { status: RunStatus; approvalsThisRound: number }) {
  if (status !== 'SUBMITTED') return 'Only submitted runs can be recalled.'
  if (approvalsThisRound > 0) return 'Someone has already approved this version. Ask an approver to request changes instead.'
  return null
}

export function checkDecision({
  status,
  approverId,
  submittedById,
  alreadyDecided,
  ownPayChanged,
}: {
  status: RunStatus
  approverId: string
  submittedById: string | null
  /** This approver already approved or requested changes on the current submission round */
  alreadyDecided: boolean
  /** The approver's own payroll line is new or changed in this run */
  ownPayChanged: boolean
}) {
  if (status !== 'SUBMITTED') return 'This run isn’t waiting for approval.'
  if (submittedById === approverId) return 'You submitted this run, so someone else must approve it.'
  if (alreadyDecided) return 'You’ve already reviewed this version.'
  if (ownPayChanged) return 'This run changes your own pay, so another approver must review it.'
  return null
}

/** Approvals still needed on the current round. */
export function approvalsRemaining(required: number, approvalsThisRound: number) {
  return Math.max(0, Math.max(1, required) - approvalsThisRound)
}

export function checkMarkPaid({ status }: { status: RunStatus }) {
  if (status !== 'APPROVED') return 'Only approved runs can be marked as paid.'
  return null
}

export function checkEditable({ status }: { status: RunStatus }) {
  if (status !== 'DRAFT') return 'This run is locked. Recall it or ask for changes to edit it.'
  return null
}

/**
 * The tax configuration in force for a pay period: the most recent approved, active one that starts on
 * or before it. Rules carry forward until a newer configuration replaces them, and a month-specific
 * configuration beats the whole-year one (month 0) for the same year.
 */
export function effectiveTaxConfig<T extends { year: number; month: number; isActive: boolean; approvedAt: Date | null }>(configs: T[], year: number, month: number): T | null {
  const startsBy = (c: T) => c.year < year || (c.year === year && c.month <= month)
  return configs.filter((c) => c.isActive && c.approvedAt && startsBy(c)).sort((a, b) => b.year - a.year || b.month - a.month)[0] ?? null
}
