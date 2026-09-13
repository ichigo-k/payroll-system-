import type { RoleName } from './roles'

/**
 * Who can do what. The single source of truth for navigation, pages and server actions.
 *
 * Built on segregation of duties:
 * - Admins run the system (users, settings) but can't touch payroll data.
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
  'employees.edit': ['PREPARER'],
  /** Workspace roles and self-service blocking are access decisions, so they belong to admins */
  'employees.access': ['ADMIN'],

  'salary.view': ['PREPARER', 'APPROVER', 'AUDITOR'],
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
