/**
 * Turns raw audit entries into readable sentences for timelines and the audit log.
 */

export type AuditRow = {
  id: string
  action: string
  entityType: string
  entityId: string
  changes: string | null
  timestamp: Date
  ipAddress?: string | null
  userAgent?: string | null
  user: { id: string; firstName: string | null; lastName: string | null; email: string }
}

export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  SUBMIT: 'Submitted',
  APPROVE: 'Approved',
  REJECT: 'Sent back',
  DOWNLOAD: 'Exported',
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  RECALL: 'Recalled',
  COMMENT: 'Commented',
  ACTIVATE: 'Activated',
  MARK_PAID: 'Marked paid',
}

export const ENTITY_LABELS: Record<string, string> = {
  PayrollRun: 'Payroll run',
  Employee: 'Employee',
  User: 'User',
  TaxConfiguration: 'Tax configuration',
  SalaryConfiguration: 'Salary',
  SystemConfig: 'Company settings',
  AuditLog: 'Audit log',
  Allowance: 'Allowance',
  Deduction: 'Deduction',
}

export function actorName(user: AuditRow['user']) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

export function parseChanges(changes: string | null): Record<string, unknown> {
  if (!changes) return {}
  try {
    const value = JSON.parse(changes)
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  department: 'Department',
  designation: 'Job title',
  startDate: 'Start date',
  employmentStatus: 'Employment status',
  bankName: 'Bank',
  accountName: 'Account name',
  accountNumber: 'Account number',
  ssnit_number: 'SSNIT number',
  ssnitNumber: 'SSNIT number',
  tin: 'TIN',
  baseSalary: 'Basic salary',
  role: 'Role',
  status: 'Status',
  totalNetPay: 'Total net pay',
  headcount: 'Employees',
  requiredApprovals: 'Required approvals',
  userId: 'Linked login',
}

/** A `{ from, to }` change rendered for display. */
export type FieldChange = { field: string; from: string; to: string }

export function fieldChanges(changes: Record<string, unknown>): FieldChange[] {
  return Object.entries(changes)
    .filter(([, value]) => value && typeof value === 'object' && 'from' in (value as object) && 'to' in (value as object))
    .map(([key, value]) => {
      const { from, to } = value as { from: unknown; to: unknown }
      return { field: FIELD_LABELS[key] ?? key, from: from === null || from === undefined || from === '' ? 'empty' : String(from), to: to === null || to === undefined || to === '' ? 'empty' : String(to) }
    })
}

/** Short description of what happened, for a payroll run timeline. */
export function describeRunEvent(row: AuditRow): string {
  const c = parseChanges(row.changes)
  switch (row.action) {
    case 'CREATE':
      return 'created this draft'
    case 'UPDATE':
      if (c.recalculated) return 'recalculated pay'
      if (c.excluded && typeof c.excluded === 'object') return `left ${String((c.excluded as { employee?: unknown }).employee ?? 'an employee')} out of this run`
      if (c.included && typeof c.included === 'object') return `added ${String((c.included as { employee?: unknown }).employee ?? 'an employee')} back into this run`
      return 'updated the run'
    case 'SUBMIT':
      return Number(c.round) > 1 ? `resubmitted for approval (version ${c.round})` : 'submitted for approval'
    case 'RECALL':
      return 'recalled the run to draft'
    case 'APPROVE':
      return c.final ? 'approved the run' : `approved (${c.approvalsRemaining} more needed)`
    case 'REJECT':
      return 'requested changes'
    case 'MARK_PAID':
      return 'marked the run as paid and published payslips'
    case 'DOWNLOAD':
      return `exported the ${String(c.document ?? 'document').toLowerCase()}`
    case 'DELETE':
      return 'deleted the draft'
    case 'COMMENT':
      return 'commented'
    default:
      return (ACTION_LABELS[row.action] ?? row.action).toLowerCase()
  }
}
