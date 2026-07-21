import Link from 'next/link'
import { auth } from '@/lib/auth-config'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  PREPARER: 'Payroll Preparer',
  APPROVER: 'Payroll Approver',
}

type Stat = { label: string; value: string; sub: string; tone?: 'default' | 'primary' | 'warn' }

const STATS: Stat[] = [
  { label: 'Employees on payroll', value: '—', sub: 'Active' },
  { label: 'Payroll runs · YTD', value: '—', sub: 'This fiscal year' },
  { label: 'Pending approvals', value: '—', sub: 'Awaiting review', tone: 'warn' },
  { label: 'Disbursed this month', value: '—', sub: 'GHS · gross', tone: 'primary' },
]

const QUICK_ACTIONS = [
  { label: 'New payroll run', href: '/portal/financial/payroll', desc: 'Open the payroll workspace for the current period' },
  { label: 'Manage employees', href: '/portal/financial/employees', desc: 'Directory, salary bands, bank details' },
  { label: 'Approval queue', href: '/portal/financial/approvals', desc: 'Review submitted runs' },
  { label: 'Reports & exports', href: '/portal/financial/reports', desc: 'GRA, SSNIT, bank transfer files, payslips' },
]

const RECENT_COLUMNS = ['Period', 'Status', 'Submitted by', 'Submitted', 'Net total', 'Employees'] as const

export default async function FinancialDashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'there'
  const role = session?.user?.role ?? ''
  const roleLabel = ROLE_LABELS[role] ?? role

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between border-b border-border pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Overview · {roleLabel}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Real-time snapshot of your payroll workspace.</p>
        </div>
        <Link
          href="/portal/financial/payroll"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 text-[12px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New payroll run
        </Link>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col justify-between bg-card px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p
              className={`num mt-2 text-2xl font-semibold tracking-tight ${
                s.tone === 'primary' ? 'text-primary' : s.tone === 'warn' ? 'text-amber-400' : 'text-foreground'
              }`}
            >
              {s.value}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Two column: Quick actions + Recent runs */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick actions */}
        <section className="rounded-md border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
          </header>
          <ul>
            {QUICK_ACTIONS.map((a) => (
              <li key={a.href} className="border-b border-border last:border-b-0">
                <Link
                  href={a.href}
                  className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{a.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.desc}</p>
                  </div>
                  <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent runs — data grid style */}
        <section className="rounded-md border border-border bg-card lg:col-span-2">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent payroll runs</p>
              <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">0 rows</span>
            </div>
            <Link href="/portal/financial/payroll" className="text-[11px] font-medium text-primary hover:underline">
              View all
            </Link>
          </header>

          {/* Grid header */}
          <div className="grid grid-cols-6 gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {RECENT_COLUMNS.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>

          {/* Empty state */}
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-[13px] font-medium text-foreground">No payroll runs yet</p>
            <p className="mt-1 max-w-sm text-[11px] text-muted-foreground">
              Once you start a payroll run, it will appear here with status, totals and reviewers.
            </p>
            <Link
              href="/portal/financial/payroll"
              className="mt-4 inline-flex h-7 items-center gap-1.5 rounded border border-border bg-muted/40 px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              Start a run
              <span>→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
