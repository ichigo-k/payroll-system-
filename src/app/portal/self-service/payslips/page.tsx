import type { Metadata } from 'next'
import Link from 'next/link'
import { parsePage } from '@/lib/pagination'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { PUBLISHED, requireSelfServiceEmployee } from '@/lib/self-service'
import { ListTabs, queryHref } from '@/components/app/list-tabs'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'

export const metadata: Metadata = { title: 'Payslips' }

export default async function PayslipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { employee } = await requireSelfServiceEmployee()
  const raw = await searchParams
  const { page, pageSize, skip, take } = parsePage(raw, 12)

  if (!employee) {
    return (
      <div>
        <PageHeader title="Payslips" />
        <p className="text-sm text-muted-foreground">Your login isn’t linked to an employee record yet.</p>
      </div>
    )
  }

  const years = (await prisma.payrollRun.findMany({ where: { status: 'PAID', payrollDetails: { some: { employeeId: employee.id } } }, distinct: ['year'], select: { year: true }, orderBy: { year: 'desc' } })).map((r) => r.year)
  const year = typeof raw.year === 'string' && years.includes(Number(raw.year)) ? Number(raw.year) : undefined
  const where = { employeeId: employee.id, payrollRun: { status: 'PAID' as const, ...(year ? { year } : {}) } }

  const [lines, total] = await Promise.all([
    prisma.payrollDetail.findMany({ where, include: { payrollRun: { select: { month: true, year: true, paidAt: true } } }, orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }], skip, take }),
    prisma.payrollDetail.count({ where: { employeeId: employee.id, ...PUBLISHED, ...(year ? { payrollRun: { status: 'PAID', year } } : {}) } }),
  ])
  const current = { year: year ? String(year) : undefined, size: typeof raw.size === 'string' ? raw.size : undefined }

  return (
    <div>
      <PageHeader title="Payslips" description="Payslips appear once payroll for the month has been paid." />

      {years.length > 1 && (
        <ListTabs
          label="Years"
          tabs={[
            { key: 'all', label: 'All years', active: !year, href: queryHref('/portal/self-service/payslips', current, { year: undefined }) },
            ...years.map((y) => ({ key: String(y), label: String(y), active: year === y, href: queryHref('/portal/self-service/payslips', current, { year: y }) })),
          ]}
        />
      )}

      {lines.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">No payslips yet</p>
          <p className="mt-1 text-sm text-muted-foreground">You’ll get a notification and an email when your first payslip is ready.</p>
        </div>
      ) : (
        <>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">Period</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Gross pay</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Deductions</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Net pay</th>
                  <th scope="col" className="py-2 pl-4 font-semibold">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-border hover:bg-muted">
                    <td className="py-3 pr-4 font-medium">{periodLabel(line.payrollRun.month, line.payrollRun.year)}</td>
                    <td className="num px-4 py-3 text-right">{formatCurrency(Number(line.grossIncome))}</td>
                    <td className="num px-4 py-3 text-right">{formatCurrency(Number(line.totalDeductions))}</td>
                    <td className="num px-4 py-3 text-right font-semibold">{formatCurrency(Number(line.netPay))}</td>
                    <td className="py-3 pl-4 text-right">
                      <Link href={`/portal/self-service/payslips/${line.id}`} className="font-medium text-primary hover:underline">
                        View payslip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} noun="payslips" hrefFor={(p, size) => queryHref('/portal/self-service/payslips', current, { page: p, size })} />
        </>
      )}
    </div>
  )
}
