/**
 * Employee lifecycle rules. People who have been paid are never deleted: payroll, tax and SSNIT
 * records must be kept, so leavers are offboarded with an end date and a reason instead.
 */

export const OFFBOARDING_REASONS = ['Resignation', 'End of contract', 'Retirement', 'Dismissal', 'Redundancy', 'Death', 'Other'] as const

type EmployeeState = { id: string; employmentStatus: string; startDate: Date; endDate?: Date | null }

export function checkOffboard({
  actorEmployeeId,
  employee,
  endDate,
  reason,
}: {
  actorEmployeeId: string | null
  employee: EmployeeState
  endDate: Date | null
  reason: string
}): string | null {
  if (actorEmployeeId === employee.id) return 'You can’t offboard yourself. Ask another administrator.'
  if (employee.employmentStatus === 'TERMINATED') return 'This employee has already left.'
  if (!endDate || Number.isNaN(endDate.getTime())) return 'Choose their last working day.'
  if (endDate < employee.startDate) return 'The last working day can’t be before their start date.'
  if (!(OFFBOARDING_REASONS as readonly string[]).includes(reason)) return 'Choose why they’re leaving.'
  return null
}

export function checkReinstate({ actorEmployeeId, employee }: { actorEmployeeId: string | null; employee: EmployeeState }): string | null {
  if (actorEmployeeId === employee.id) return 'You can’t reinstate yourself. Ask another administrator.'
  if (employee.employmentStatus !== 'TERMINATED') return 'Only employees who have left can be reinstated.'
  return null
}

export function checkDelete({
  actorEmployeeId,
  employee,
  payrollLines,
  workspaceRole,
}: {
  actorEmployeeId: string | null
  employee: { id: string }
  /** Lines in any payroll run, including drafts */
  payrollLines: number
  /** Role of the linked login when it isn't a plain employee login */
  workspaceRole: string | null
}): string | null {
  if (actorEmployeeId === employee.id) return 'You can’t delete your own employee record.'
  if (payrollLines > 0) return 'This person is in a payroll run, so their record has to be kept. Offboard them instead.'
  if (workspaceRole) return 'This person also has workspace access. Ask an administrator to remove it first.'
  return null
}
