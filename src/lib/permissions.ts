import type { RoleName } from './roles'

/**
 * Who can do what. The single source of truth for navigation, pages and server actions.
 *
 * Built on segregation of duties:
 * - Admins run the system (users, settings) and keep employee records (HR), but can't see or change pay.
 * - Whoever adds a person can't also set their pay, which blocks "ghost employees".
 * - Preparers make changes (maker); approvers check them (checker). Nobody approves their own work.
 * - Auditors can see everything and change nothing.
 */
export const PERMISSIONS = {
  'users.manage': ['ADMIN'],
  'users.view': ['ADMIN', 'AUDITOR'],
  'settings.manage': ['ADMIN'],
  'settings.view': ['ADMIN', 'AUDITOR'],
  'audit.view': ['ADMIN', 'APPROVER', 'AUDITOR'],

  'employees.view': ['ADMIN', 'PREPARER', 'APPROVER', 'AUDITOR'],
  /** Personal, job and bank details, plus joining and leaving. Bank details stay away from the people who run payroll. */
  'employees.edit': ['ADMIN'],
  /** Workspace roles and self-service blocking are access decisions, so they belong to admins */
  'employees.access': ['ADMIN'],

  'salary.view': ['PREPARER', 'APPROVER', 'AUDITOR'],
  /** Salary, allowances, deductions, and SSNIT number and TIN */
  'salary.edit': ['PREPARER'],

  'tax.view': ['PREPARER', 'APPROVER', 'AUDITOR'],
  'tax.draft': ['PREPARER'],
  'tax.activate': ['APPROVER'],

  'payroll.view': ['PREPARER', 'APPROVER', 'AUDITOR'],
  'payroll.prepare': ['PREPARER'],
  'payroll.approve': ['APPROVER'],
  'payroll.comment': ['PREPARER', 'APPROVER'],

  'reports.export': ['PREPARER', 'APPROVER', 'AUDITOR'],
} as const satisfies Record<string, readonly RoleName[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: string | null | undefined, permission: Permission) {
  return !!role && (PERMISSIONS[permission] as readonly string[]).includes(role)
}
