export const ROLES = ['ADMIN', 'PREPARER', 'APPROVER', 'AUDITOR', 'EMPLOYEE'] as const
export type RoleName = (typeof ROLES)[number]

/** Roles that use the payroll workspace (everything except self-service-only employees). */
export const FINANCIAL_ROLES: readonly RoleName[] = ['ADMIN', 'PREPARER', 'APPROVER', 'AUDITOR']

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
    summary: 'Manages users, roles and company settings. Doesn’t prepare or approve payroll.',
    access: ['Invite people and manage roles', 'Update company, bank and approval settings', 'Review the audit log'],
  },
  PREPARER: {
    label: 'Payroll preparer',
    summary: 'Maintains employees and salaries, drafts tax settings and prepares payroll runs.',
    access: ['Add, import and edit employees', 'Set salaries, allowances and deductions', 'Draft tax configuration', 'Prepare, submit and export payroll runs'],
  },
  APPROVER: {
    label: 'Payroll approver',
    summary: 'Reviews submitted payroll runs and tax changes, then approves or sends them back.',
    access: ['Approve or request changes on payroll runs', 'Activate tax configuration', 'Export reports', 'Review the audit log'],
  },
  AUDITOR: {
    label: 'Auditor',
    summary: 'Read-only access to payroll, employees, reports and the full audit log.',
    access: ['View payroll runs and their history', 'View employees, salaries and tax settings', 'Export reports and the audit log'],
  },
  EMPLOYEE: {
    label: 'Employee',
    summary: 'Self-service access to their own pay records.',
    access: ['View and download payslips', 'See payment history', 'See tax and SSNIT contributions'],
  },
}
