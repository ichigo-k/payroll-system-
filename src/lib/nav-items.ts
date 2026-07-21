// src/lib/nav-items.ts

export type NavItem = { label: string; href: string }

const PREPARER_ITEMS: NavItem[] = [
  { label: 'Employees',     href: '/portal/financial/employees' },
  { label: 'Salary Config', href: '/portal/financial/salary' },
  { label: 'Tax Config',    href: '/portal/financial/tax' },
  { label: 'Payroll Prep',  href: '/portal/financial/payroll' },
  { label: 'Reports',       href: '/portal/financial/reports' },
]

const APPROVER_ITEMS: NavItem[] = [
  { label: 'Approval Queue', href: '/portal/financial/approvals' },
  { label: 'Payroll Review', href: '/portal/financial/review' },
  { label: 'Reports',        href: '/portal/financial/reports' },
]

const ADMIN_EXTRA_ITEMS: NavItem[] = [
  { label: 'User Management', href: '/portal/financial/users' },
  { label: 'System Config',   href: '/portal/financial/config' },
  { label: 'Audit Logs',      href: '/portal/financial/audit' },
]

export function getFinancialNavItems(role: string): NavItem[] {
  const items = (() => {
    switch (role) {
      case 'PREPARER': return PREPARER_ITEMS
      case 'APPROVER': return APPROVER_ITEMS
      case 'ADMIN':    return [...PREPARER_ITEMS, ...APPROVER_ITEMS, ...ADMIN_EXTRA_ITEMS]
      default:         return []
    }
  })()

  // Deduplicate by href — keeps first occurrence
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}

export const SELF_SERVICE_NAV_ITEMS: NavItem[] = [
  { label: 'Payslips',        href: '/portal/self-service/payslips' },
  { label: 'Payment History', href: '/portal/self-service/history' },
  { label: 'Tax Certificate', href: '/portal/self-service/tax' },
  { label: 'Profile',         href: '/portal/self-service/profile' },
]
