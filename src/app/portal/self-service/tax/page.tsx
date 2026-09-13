import { Download } from 'lucide-react'
import type { Metadata } from 'next'
import { ListTabs } from '@/components/app/list-tabs'
import { PageHeader } from '@/components/app/page-header'
import { button } from '@/components/app/styles'
import { formatCurrency } from '@/lib/payroll'
import { prisma } from '@/lib/prisma'
import { requireSelfServiceEmployee } from '@/lib/self-service'

export const metadata: Metadata = { title: 'Tax & SSNIT' }

const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleString('en-GB', { month: 'long' })

export default async function TaxSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { employee } = await requireSelfServiceEmployee()
  const raw = await searchParams

  const years = employee
    ? (
        await prisma.payrollRun.findMany({
          where: { status: 'PAID', payrollDetails: { some: { employeeId: employee.id } } },
          distinct: ['year'],
          select: { year: true },
          orderBy: { year: 'desc' },
        })
      ).map((r) => r.year)
    : []
  const year = typeof raw.year === 'string' && years.includes(Number(raw.year)) ? Number(raw.year) : (years[0] ?? new Date().getFullYear())

  const lines = employee
    ? await prisma.payrollDetail.findMany({
        where: { employeeId: employee.id, payrollRun: { status: 'PAID', year } },
        include: { payrollRun: { select: { month: true } } },
        orderBy: { payrollRun: { month: 'asc' } },
      })
    : []
  const sum = (key: 'grossIncome' | 'taxableIncome' | 'paye' | 'ssnitEmployee' | 'ssnitEmployer') => lines.reduce((total, l) => total + Number(l[key]), 0)

  return (
    <div>
      <PageHeader
        title="Tax & SSNIT"
        description="What was deducted for PAYE and what went into your pension, month by month. Use this for your personal tax records."
        actions={
          years.includes(year) && (
            <a href={`/portal/self-service/tax/certificate/${year}`} className={button.primary}>
              <Download className="size-4" />
              {year} tax certificate
            </a>
          )
        }
      />

      {years.length > 1 && (
        <ListTabs label="Tax years" tabs={years.map((y) => ({ key: String(y), label: String(y), active: y === year, href: `/portal/self-service/tax?year=${y}` }))} />
      )}

      {lines.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">Nothing for {year} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Totals appear once payroll has been paid.</p>
        </div>
      ) : (
        <>
          <dl className="mt-2 grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
            {[
              ['Gross pay', sum('grossIncome')],
              ['PAYE deducted', sum('paye')],
              ['Your SSNIT', sum('ssnitEmployee')],
              ['Employer SSNIT', sum('ssnitEmployer')],
            ].map(([label, value]) => (
              <div key={label as string} className="pr-4">
                <dt className="text-sm text-muted-foreground">
                  {label} in {year}
                </dt>
                <dd className="num mt-1 text-xl font-semibold tracking-tight">{formatCurrency(value as number)}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Month
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Gross pay
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Chargeable income
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    PAYE
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Your SSNIT
                  </th>
                  <th scope="col" className="py-2 pl-4 text-right font-semibold">
                    Employer SSNIT
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-border">
                    <td className="py-2.5 pr-4 font-medium">{monthName(line.payrollRun.month)}</td>
                    <td className="num px-4 py-2.5 text-right">{formatCurrency(Number(line.grossIncome))}</td>
                    <td className="num px-4 py-2.5 text-right">{formatCurrency(Number(line.taxableIncome))}</td>
                    <td className="num px-4 py-2.5 text-right">{formatCurrency(Number(line.paye))}</td>
                    <td className="num px-4 py-2.5 text-right">{formatCurrency(Number(line.ssnitEmployee))}</td>
                    <td className="num py-2.5 pl-4 text-right">{formatCurrency(Number(line.ssnitEmployer))}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2.5 pr-4">Total</td>
                  <td className="num px-4 py-2.5 text-right">{formatCurrency(sum('grossIncome'))}</td>
                  <td className="num px-4 py-2.5 text-right">{formatCurrency(sum('taxableIncome'))}</td>
                  <td className="num px-4 py-2.5 text-right">{formatCurrency(sum('paye'))}</td>
                  <td className="num px-4 py-2.5 text-right">{formatCurrency(sum('ssnitEmployee'))}</td>
                  <td className="num py-2.5 pl-4 text-right">{formatCurrency(sum('ssnitEmployer'))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
