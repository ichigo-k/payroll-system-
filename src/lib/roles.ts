export const ROLES = ['ADMIN', 'PREPARER', 'APPROVER', 'EMPLOYEE'] as const
export type RoleName = (typeof ROLES)[number]

export const FINANCIAL_ROLES: readonly RoleName[] = ['ADMIN', 'PREPARER', 'APPROVER']

export function isRole(value: unknown): value is RoleName {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function isFinancialRole(role: string | null | undefined) {
  return !!role && (FINANCIAL_ROLES as readonly string[]).includes(role)
}

/** Human-readable role copy, shared by the UI and emails. */
export const ROLE_INFO: Record<RoleName, { label: string; summary: string; access: string[] }> = {
  ADMIN: {
    label: 'Administrator',
    summary: 'Full access, including users, tax and system settings.',
    access: ['Manage users and roles', 'Configure tax and system settings', 'Prepare and approve payroll', 'View audit logs'],
  },
  PREPARER: {
    label: 'Payroll preparer',
    summary: 'Maintains employee records and prepares payroll runs.',
    access: ['Add and import employees', 'Set salaries, allowances and deductions', 'Prepare and submit payroll runs', 'Generate reports'],
  },
  APPROVER: {
    label: 'Payroll approver',
    summary: 'Reviews submitted payroll runs and approves or rejects them.',
    access: ['Review submitted payroll runs', 'Approve or reject runs', 'View reports'],
  },
  EMPLOYEE: {
    label: 'Employee',
    summary: 'Self-service access to their own pay records.',
    access: ['View and download payslips', 'See payment history', 'Download tax certificates'],
  },
}
