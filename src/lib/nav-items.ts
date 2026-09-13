// src/lib/nav-items.ts
import { can, type Permission } from './permissions'

export type NavItem = { label: string; href: string }

const FINANCIAL_NAV: (NavItem & { permission: Permission })[] = [
  { label: 'Payroll runs', href: '/portal/financial/payroll', permission: 'payroll.view' },
  { label: 'Approval queue', href: '/portal/financial/approvals', permission: 'payroll.approve' },
  { label: 'Employees', href: '/portal/financial/employees', permission: 'employees.view' },
  { label: 'Salaries', href: '/portal/financial/salary', permission: 'salary.view' },
  { label: 'Tax configuration', href: '/portal/financial/tax', permission: 'tax.view' },
  { label: 'User management', href: '/portal/financial/users', permission: 'users.view' },
  { label: 'Company settings', href: '/portal/financial/config', permission: 'settings.view' },
  { label: 'Reports', href: '/portal/financial/reports', permission: 'reports.export' },
  { label: 'Exports', href: '/portal/financial/exports', permission: 'employees.view' },
  { label: 'Audit log', href: '/portal/financial/audit', permission: 'audit.view' },
]

export function getFinancialNavItems(role: string): NavItem[] {
  return FINANCIAL_NAV.filter((item) => can(role, item.permission)).map(({ label, href }) => ({ label, href }))
}

export const SELF_SERVICE_NAV_ITEMS: NavItem[] = [
  { label: 'Payslips', href: '/portal/self-service/payslips' },
  { label: 'Payment history', href: '/portal/self-service/history' },
  { label: 'Tax & SSNIT', href: '/portal/self-service/tax' },
  { label: 'Profile', href: '/portal/self-service/profile' },
]
