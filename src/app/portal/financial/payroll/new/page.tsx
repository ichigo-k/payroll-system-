import { TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { link } from '@/components/app/styles'
import { requirePermission } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { NewRunForm } from './new-run-form'

export const metadata: Metadata = { title: 'New payroll run' }

export default async function NewPayrollRunPage() {
  const actor = await requirePermission('payroll.prepare')
  if (!actor) return <NoPermission title="You can’t start payroll runs" description="Only payroll preparers can prepare payroll." />

  const [runs, activeEmployees, withSalary, approvedTax] = await Promise.all([
    prisma.payrollRun.findMany({ select: { year: true, month: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE', salaryConfigs: { some: {} } } }),
    prisma.taxConfiguration.count({ where: { isActive: true, approvedAt: { not: null } } }),
  ])

  // Default to the month after the latest run, or the current month
  const now = new Date()
  const latest = runs[0]
  const next = latest ? new Date(latest.year, latest.month, 1) : new Date(now.getFullYear(), now.getMonth(), 1)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: 'Payroll' }, { label: 'Payroll runs', href: '/portal/financial/payroll' }, { label: 'New run' }]}
        title="New payroll run"
        description="We’ll calculate PAYE, SSNIT and net pay for every active employee with a salary, using the approved tax configuration."
      />

      {(approvedTax === 0 || withSalary < activeEmployees) && (
        <div role="note" className="mb-5 flex items-start gap-2.5 rounded-lg bg-warning-soft px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="space-y-1">
            {approvedTax === 0 && (
              <p>
                There’s no approved tax configuration yet, so pay can’t be calculated.{' '}
                <Link href="/portal/financial/tax" className={link}>
                  Set up tax configuration
                </Link>
              </p>
            )}
            {withSalary < activeEmployees && (
              <p>
                {activeEmployees - withSalary} of {activeEmployees} active employees don’t have a salary and will be left out.{' '}
                <Link href="/portal/financial/salary?view=missing" className={link}>
                  Set salaries
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      <NewRunForm defaultYear={next.getFullYear()} defaultMonth={next.getMonth() + 1} takenPeriods={runs.map((r) => `${r.year}-${r.month}`)} />
    </div>
  )
}
