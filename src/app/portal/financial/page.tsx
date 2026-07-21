import { auth } from '@/lib/auth-config'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  PREPARER: 'Payroll Preparer',
  APPROVER: 'Payroll Approver',
}

const stats = [
  {
    label: 'Payroll Runs',
    value: '—',
    sub: 'This month',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Active Employees',
    value: '—',
    sub: 'On payroll',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Pending Approvals',
    value: '—',
    sub: 'Awaiting review',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Total Disbursed',
    value: '—',
    sub: 'This month',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

const quickActions = [
  {
    label: 'New Payroll Run',
    desc: 'Start a new payroll cycle',
    href: '/portal/financial/payroll',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    label: 'Employees',
    desc: 'Manage staff records',
    href: '/portal/financial/employees',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Tax Config',
    desc: 'PAYE & SSNIT settings',
    href: '/portal/financial/tax',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    desc: 'Generate & download',
    href: '/portal/financial/reports',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default async function FinancialDashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'there'
  const role = session?.user?.role ?? ''
  const roleLabel = ROLE_LABELS[role] ?? role

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">

      {/* Page header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/20 p-8 shadow-sm backdrop-blur-xl dark:from-indigo-500/20 dark:via-purple-500/10 dark:border-white/10">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-purple-500/20 blur-2xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500/80 dark:text-indigo-400">{roleLabel}</p>
            <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200/50 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
              Financial Portal
            </Badge>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400 max-w-lg">
            Here&apos;s your payroll workspace overview. Everything looks good today.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div>
        <p className="mb-5 text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Overview</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/50 px-6 py-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-white/10 dark:bg-gray-900/50"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
              <div className="relative z-10 flex items-start justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {stat.icon}
                </div>
              </div>
              <p className="relative z-10 mt-4 text-4xl font-black tabular-nums tracking-tight text-gray-900 dark:text-white">{stat.value}</p>
              <p className="relative z-10 mt-1.5 text-sm font-medium text-gray-400 dark:text-gray-500">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="mb-5 text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Quick actions</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="group relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/50 px-6 py-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-white/10 dark:bg-gray-900/50 dark:hover:border-indigo-500/30"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200/50 bg-gray-50 text-gray-500 transition-all duration-300 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400 dark:group-hover:border-indigo-500/30 dark:group-hover:bg-indigo-500/20 dark:group-hover:text-indigo-300">
                  {action.icon}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{action.label}</p>
                  <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">{action.desc}</p>
                </div>
                <span className="mt-2 flex items-center text-sm font-bold text-indigo-600 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1 dark:text-indigo-400">
                  Open <span className="ml-1 text-lg">→</span>
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <p className="mb-5 text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Recent activity</p>
        <div className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/50 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/50">
          {/* Table header */}
          <div className="border-b border-gray-100/50 bg-gray-50/50 px-8 py-4 backdrop-blur-md dark:border-gray-800/50 dark:bg-gray-800/30">
            <div className="grid grid-cols-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span>Event</span>
              <span>Initiated by</span>
              <span>Date</span>
              <span>Status</span>
            </div>
          </div>
          {/* Empty state */}
          <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50/80 shadow-inner dark:bg-gray-800/50">
              <svg className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="mt-5 text-base font-bold text-gray-900 dark:text-white">No activity yet</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">Payroll runs and approvals will appear here once they are initiated.</p>
          </div>
        </div>
      </div>

    </div>
  )
}
