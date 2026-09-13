import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { Search } from 'lucide-react'
import { can, requirePermission } from '@/lib/access'
import { parsePage } from '@/lib/pagination'
import { formatCurrency } from '@/lib/payroll'
import { prisma } from '@/lib/prisma'
import { ListTabs, queryHref } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'
import { button, field } from '@/components/app/styles'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Salaries' }

const VIEWS: Record<string, { label: string; where: () => Prisma.EmployeeWhereInput }> = {
  all: { label: 'Active employees', where: () => ({}) },
  missing: { label: 'No salary', where: () => ({ salaryConfigs: { none: {} } }) },
  allowances: { label: 'With allowances', where: () => ({ allowances: { some: { isActive: true } } }) },
  deductions: { label: 'With deductions', where: () => ({ deductions: { some: { isActive: true } } }) },
}

const monthly = (amount: number, frequency: string) => (frequency === 'annual' ? amount / 12 : amount)

export default async function SalariesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('salary.view')
  if (!actor) return <NoPermission title="You can’t view salaries" description="Salaries are available to preparers, approvers and auditors." />

  const raw = await searchParams
  const view = typeof raw.view === 'string' && raw.view in VIEWS ? raw.view : 'all'
  const q = typeof raw.q === 'string' ? raw.q.trim() : ''
  const { page, pageSize, skip, take } = parsePage(raw)
  const current = { view: view === 'all' ? undefined : view, q: q || undefined, size: typeof raw.size === 'string' ? raw.size : undefined }

  const search: Prisma.EmployeeWhereInput = q
    ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { employeeId: { contains: q, mode: 'insensitive' } }, { department: { contains: q, mode: 'insensitive' } }] }
    : {}
  const where = (key: string): Prisma.EmployeeWhereInput => ({ AND: [{ employmentStatus: 'ACTIVE' }, VIEWS[key].where(), search] })
  const keys = Object.keys(VIEWS)
  const now = new Date()

  const [employees, total, ...counts] = await Promise.all([
    prisma.employee.findMany({
      where: where(view),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take,
      include: {
        salaryConfigs: { where: { effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
        allowances: { where: { isActive: true }, select: { amount: true, frequency: true } },
        deductions: { where: { isActive: true }, select: { amount: true, frequency: true } },
      },
    }),
    prisma.employee.count({ where: where(view) }),
    ...keys.map((key) => prisma.employee.count({ where: where(key) })),
  ])

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'People' }, { label: 'Salaries', href: '/portal/financial/salary' }]}
        title="Salaries"
        description={
          can(actor.role, 'salary.edit')
            ? 'Basic pay, allowances and deductions for active employees. Open someone to change their pay; every change is recorded.'
            : 'Basic pay, allowances and deductions for active employees.'
        }
      />

      <ListTabs label="Salary views" tabs={keys.map((key, i) => ({ key, label: VIEWS[key].label, count: counts[i], active: key === view, href: queryHref('/portal/financial/salary', current, { view: key === 'all' ? undefined : key }) }))} />

      <form action="/portal/financial/salary" className="flex flex-wrap items-center gap-2 py-4">
        {view !== 'all' && <input type="hidden" name="view" value={view} />}
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search employees</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtlest" />
          <input name="q" type="search" defaultValue={q} placeholder="Search by name, ID or department" className={cn(field, 'pl-8')} />
        </label>
        {q && (
          <Link href={queryHref('/portal/financial/salary', current, { q: undefined })} className={button.subtle}>
            Clear search
          </Link>
        )}
      </form>

      {employees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">{view === 'missing' && !q ? 'Everyone has a salary' : 'No employees match'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{view === 'missing' && !q ? 'All active employees will be included in payroll runs.' : 'Try another view or search.'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Basic salary</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Allowances / month</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Deductions / month</th>
                  <th scope="col" className="py-2 pl-4 font-semibold">Since</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const salary = e.salaryConfigs[0]
                  const allowances = e.allowances.reduce((sum, a) => sum + monthly(Number(a.amount), a.frequency), 0)
                  const deductions = e.deductions.reduce((sum, d) => sum + monthly(Number(d.amount), d.frequency), 0)
                  return (
                    <tr key={e.id} className="border-b border-border hover:bg-muted">
                      <td className="py-2.5 pr-4">
                        <Link href={`/portal/financial/employees/${e.id}?tab=pay`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {e.firstName} {e.lastName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{e.employeeId}</span> · {e.department}
                        </p>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{salary ? <span className="font-medium">{formatCurrency(Number(salary.baseSalary))}</span> : <span className="font-medium text-danger">Not set</span>}</td>
                      <td className="num px-4 py-2.5 text-right">{allowances ? formatCurrency(allowances) : <span className="text-subtlest">None</span>}</td>
                      <td className="num px-4 py-2.5 text-right">{deductions ? formatCurrency(deductions) : <span className="text-subtlest">None</span>}</td>
                      <td className="num py-2.5 pl-4 text-muted-foreground">{salary ? salary.effectiveFrom.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} noun="employees" hrefFor={(p, size) => queryHref('/portal/financial/salary', current, { page: p, size })} />
        </>
      )}
    </div>
  )
}
