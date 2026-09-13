import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { auth } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { formatCurrency, hasPermission } from '@/lib/payroll'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button, link } from '@/components/app/styles'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Home' }

function periodLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

export default async function FinancialDashboardPage() {
  const session = await auth()
  const role = session?.user?.role ?? ''
  const firstName = session?.user?.firstName
  const now = new Date()
  const year = now.getFullYear()

  const [activeEmployees, runsThisYear, awaitingApproval, recentRuns, taxConfigCount, employeesWithSalary] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
    prisma.payrollRun.count({ where: { year } }),
    prisma.payrollRun.count({ where: { status: 'SUBMITTED' } }),
    prisma.payrollRun.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6 }),
    prisma.taxConfiguration.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE', salaryConfigs: { some: {} } } }),
  ])

  const latestRun = recentRuns[0]
  const canPrepare = hasPermission(role, 'submit_payroll')
  const canApprove = hasPermission(role, 'approve_payroll')

  const stats = [
    { label: 'Active employees', value: activeEmployees.toLocaleString('en-GB'), href: '/portal/financial/employees?view=active' },
    { label: `Payroll runs in ${year}`, value: runsThisYear.toLocaleString('en-GB') },
    { label: 'Waiting for approval', value: awaitingApproval.toLocaleString('en-GB'), href: canApprove ? '/portal/financial/approvals' : undefined, attention: awaitingApproval > 0 },
    { label: latestRun ? `Net pay, ${periodLabel(latestRun.month, latestRun.year)}` : 'Latest net pay', value: latestRun ? formatCurrency(Number(latestRun.totalNetPay)) : 'None yet' },
  ]

  const setup = [
    { label: 'Add employees', detail: activeEmployees ? `${activeEmployees} active on payroll` : 'Add people or import a spreadsheet', done: activeEmployees > 0, href: '/portal/financial/employees?panel=new' },
    { label: 'Configure PAYE and SSNIT', detail: taxConfigCount ? 'Active tax configuration in place' : 'Set brackets, reliefs and SSNIT rates', done: taxConfigCount > 0, href: '/portal/financial/tax' },
    { label: 'Set salaries', detail: activeEmployees ? `${employeesWithSalary} of ${activeEmployees} employees have a salary` : 'Assign base salary and allowances', done: activeEmployees > 0 && employeesWithSalary >= activeEmployees, href: '/portal/financial/salary' },
    { label: 'Run first payroll', detail: recentRuns.length ? 'Payroll history started' : 'Prepare, submit and approve a run', done: recentRuns.length > 0, href: '/portal/financial/payroll' },
  ]
  const currentStep = setup.findIndex((step) => !step.done)
  const doneCount = setup.filter((step) => step.done).length

  return (
    <div>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description={`Here is where payroll stands for ${now.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}.`}
        actions={
          <>
            {canApprove && awaitingApproval > 0 && (
              <Link href="/portal/financial/approvals" className={button.default}>
                Review approvals
              </Link>
            )}
            {canPrepare && (
              <Link href="/portal/financial/payroll" className={button.primary}>
                New payroll run
              </Link>
            )}
          </>
        }
      />

      <dl className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const body = (
            <>
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className={cn('num mt-1 text-2xl font-semibold tracking-tight', stat.attention ? 'text-warning' : 'text-foreground')}>{stat.value}</dd>
            </>
          )
          const cellClass = cn('block px-5 first:pl-0', index % 2 === 1 && 'border-l border-border', index === 2 && 'pl-0 lg:border-l lg:pl-5')
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className={cn(cellClass, 'hover:[&_dt]:text-primary hover:[&_dt]:underline')}>
              {body}
            </Link>
          ) : (
            <div key={stat.label} className={cellClass}>
              {body}
            </div>
          )
        })}
      </dl>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="recent-runs">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-runs" className="text-base font-semibold">
              Recent payroll runs
            </h2>
            {recentRuns.length > 0 && (
              <Link href="/portal/financial/payroll" className={cn(link, 'text-sm')}>
                View all runs
              </Link>
            )}
          </div>

          {recentRuns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-input px-6 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">No payroll runs yet</p>
              <p className="mx-auto mt-1 max-w-[48ch] text-sm text-muted-foreground">
                Runs show up here once they are prepared. Work through the setup steps so PAYE, SSNIT and net pay calculate correctly.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-semibold">Period</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Gross base</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">PAYE</th>
                    <th scope="col" className="py-2 pl-4 text-right font-semibold">Net pay</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="border-b border-border hover:bg-muted">
                      <td className="py-2.5 pr-4 font-medium text-foreground">{periodLabel(run.month, run.year)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                      <td className="num px-4 py-2.5 text-right">{formatCurrency(Number(run.totalBaseSalary))}</td>
                      <td className="num px-4 py-2.5 text-right">{formatCurrency(Number(run.totalTax))}</td>
                      <td className="num py-2.5 pl-4 text-right font-semibold">{formatCurrency(Number(run.totalNetPay))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="setup" className="xl:border-l xl:border-border xl:pl-8">
          <h2 id="setup" className="text-base font-semibold">
            Get payroll ready
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-success transition-[width] duration-300 ease-out" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
            </div>
            <span className="num text-xs text-muted-foreground">
              {doneCount} of {setup.length}
            </span>
          </div>
          <ol className="mt-4 -mx-2">
            {setup.map((step, index) => {
              const isCurrent = index === currentStep
              return (
                <li key={step.label}>
                  <Link href={step.href} className={cn('group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted', isCurrent && 'bg-accent hover:bg-accent')}>
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold',
                        step.done && 'border-success bg-success text-white',
                        isCurrent && 'border-primary text-primary',
                        !step.done && !isCurrent && 'border-input text-subtlest',
                      )}
                    >
                      {step.done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm font-medium', step.done ? 'text-muted-foreground line-through decoration-subtlest/50' : 'text-foreground')}>{step.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{step.detail}</span>
                    </span>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-subtlest opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}
