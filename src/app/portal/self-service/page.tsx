import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Clock, FileText, History, Receipt, UserRound } from 'lucide-react'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { PUBLISHED, requireSelfServiceEmployee } from '@/lib/self-service'
import { PageHeader } from '@/components/app/page-header'
import { button, link } from '@/components/app/styles'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'My pay' }

const LINKS = [
  { label: 'Payslips', href: '/portal/self-service/payslips', desc: 'View, print or save every payslip', icon: Receipt },
  { label: 'Payment history', href: '/portal/self-service/history', desc: 'Net payments and the dates they were made', icon: History },
  { label: 'Tax & SSNIT', href: '/portal/self-service/tax', desc: 'PAYE and pension contributions by year', icon: FileText },
  { label: 'Profile', href: '/portal/self-service/profile', desc: 'Your details and the account you’re paid into', icon: UserRound },
]

export default async function SelfServiceHomePage() {
  const { user, employee } = await requireSelfServiceEmployee()
  const year = new Date().getFullYear()

  const [latest, ytd, processing] = employee
    ? await Promise.all([
        prisma.payrollDetail.findFirst({ where: { employeeId: employee.id, ...PUBLISHED }, include: { payrollRun: { select: { month: true, year: true, paidAt: true } } }, orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }] }),
        prisma.payrollDetail.aggregate({ where: { employeeId: employee.id, payrollRun: { status: 'PAID', year } }, _sum: { grossIncome: true, paye: true, netPay: true, ssnitEmployee: true } }),
        // Approved but not yet paid: amounts stay hidden until payday, but say it's on the way
        prisma.payrollDetail.findFirst({ where: { employeeId: employee.id, payrollRun: { status: 'APPROVED' } }, select: { payrollRun: { select: { month: true, year: true } } }, orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }] }),
      ])
    : [null, null, null]

  const stats = [
    { label: 'Latest net pay', value: latest ? formatCurrency(Number(latest.netPay)) : 'Not available yet', hint: latest ? periodLabel(latest.payrollRun.month, latest.payrollRun.year) : 'Appears after your first paid payroll' },
    { label: 'Last paid', value: latest?.payrollRun.paidAt ? latest.payrollRun.paidAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-', hint: 'Date payroll was marked paid' },
    { label: `Gross pay in ${year}`, value: formatCurrency(Number(ytd?._sum.grossIncome ?? 0)), hint: 'Year to date' },
    { label: `PAYE in ${year}`, value: formatCurrency(Number(ytd?._sum.paye ?? 0)), hint: 'Year to date' },
  ]

  return (
    <div>
      <PageHeader
        title={user.firstName ? `Hello, ${user.firstName}` : 'Hello'}
        description="Your payslips, tax records and payment history."
        actions={
          latest && (
            <Link href={`/portal/self-service/payslips/${latest.id}`} className={button.primary}>
              View latest payslip
            </Link>
          )
        }
      />

      {processing && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-foreground">
            <span className="font-semibold">Your {periodLabel(processing.payrollRun.month, processing.payrollRun.year)} pay has been approved.</span> Your payslip will appear here once the payment has been
            made, and you’ll get a notification.
          </p>
        </div>
      )}

      {!employee && (
        <p className="mb-6 rounded-lg bg-warning-soft px-4 py-3 text-sm">Your login isn’t linked to an employee record, so there’s no pay to show. Ask your payroll or HR administrator to link it.</p>
      )}

      <dl className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        {stats.map((item, index) => (
          <div key={item.label} className={cn('px-5 first:pl-0', index % 2 === 1 && 'border-l border-border', index === 2 && 'pl-0 lg:border-l lg:pl-5')}>
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="num mt-1 text-xl font-semibold tracking-tight">{item.value}</dd>
            <dd className="mt-0.5 text-xs text-subtlest">{item.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="quick-access">
          <h2 id="quick-access" className="text-base font-semibold">
            Quick access
          </h2>
          <ul className="-mx-2 mt-2">
            {LINKS.map(({ label, href, desc, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{desc}</span>
                  </span>
                  <ChevronRight className="size-4 text-subtlest transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="md:border-l md:border-border md:pl-8">
          <h2 className="text-base font-semibold">Something looks wrong?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Questions about deductions, SSNIT or your bank details go to your payroll or HR administrator.</p>
          <Link href="/portal/self-service/notifications" className={cn(link, 'mt-3 inline-block text-sm')}>
            See your notifications
          </Link>
        </aside>
      </div>
    </div>
  )
}
