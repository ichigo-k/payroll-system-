import type { Metadata } from 'next'
import Link from 'next/link'
import { parsePage } from '@/lib/pagination'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { maskAccount, PUBLISHED, requireSelfServiceEmployee } from '@/lib/self-service'
import { queryHref } from '@/components/app/list-tabs'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'

export const metadata: Metadata = { title: 'Payment history' }

export default async function PaymentHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { employee } = await requireSelfServiceEmployee()
  const raw = await searchParams
  const { page, pageSize, skip, take } = parsePage(raw, 12)

  const where = employee ? { employeeId: employee.id, ...PUBLISHED } : { id: '__none__' }
  const [lines, total, totals] = await Promise.all([
    prisma.payrollDetail.findMany({ where, include: { payrollRun: { select: { month: true, year: true, paidAt: true } } }, orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }], skip, take }),
    prisma.payrollDetail.count({ where }),
    prisma.payrollDetail.aggregate({ where, _sum: { netPay: true } }),
  ])

  return (
    <div>
      <PageHeader title="Payment history" description={total ? `${total} payments totalling ${formatCurrency(Number(totals._sum.netPay ?? 0))} in net pay.` : 'Every salary payment made to you.'} />

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">No payments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Payments show here once payroll has been paid.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">Period</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Paid on</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Paid into</th>
                  <th scope="col" className="py-2 pl-4 text-right font-semibold">Net pay</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-border hover:bg-muted">
                    <td className="py-3 pr-4">
                      <Link href={`/portal/self-service/payslips/${line.id}`} className="font-medium text-primary hover:underline">
                        {periodLabel(line.payrollRun.month, line.payrollRun.year)}
                      </Link>
                    </td>
                    <td className="num px-4 py-3">{line.payrollRun.paidAt?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {line.bankName ?? 'Bank not on file'} {maskAccount(line.accountNumber)}
                    </td>
                    <td className="num py-3 pl-4 text-right font-semibold">{formatCurrency(Number(line.netPay))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} noun="payments" hrefFor={(p, size) => queryHref('/portal/self-service/history', {}, { page: p, size })} />
        </>
      )}
    </div>
  )
}
