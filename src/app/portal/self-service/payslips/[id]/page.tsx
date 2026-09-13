import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/app/page-header'
import { LogoMark } from '@/lib/brand'
import { parseLineItems } from '@/lib/pay-items'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { maskAccount, requireSelfServiceEmployee } from '@/lib/self-service'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'Payslip' }

function Row({ label, value, strong, negative }: { label: string; value: number; strong?: boolean; negative?: boolean }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className={`py-2 pr-4 ${strong ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</td>
      <td className={`num py-2 text-right ${strong ? 'font-semibold' : ''}`}>{negative && value > 0 ? `- ${formatCurrency(value)}` : formatCurrency(value)}</td>
    </tr>
  )
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { employee } = await requireSelfServiceEmployee()
  const { id } = await params
  if (!employee) notFound()

  // Only this employee's own line, and only once the run is paid
  const line = await prisma.payrollDetail.findFirst({
    where: { id, employeeId: employee.id, payrollRun: { status: 'PAID' } },
    include: { payrollRun: { select: { month: true, year: true, paidAt: true } } },
  })
  if (!line) notFound()
  const config = await prisma.systemConfig.findFirst({ where: { isActive: true }, select: { companyName: true, address: true, taxId: true } })
  const period = periodLabel(line.payrollRun.month, line.payrollRun.year)
  // Runs calculated before itemised payslips only have totals
  const items = parseLineItems(line.lineItems)
  const itemisedAllowances = items.allowances.length > 0 || Number(line.allowancesTotal) === 0
  const itemisedDeductions = items.deductions.length > 0 || Number(line.deductionsTotal) === 0

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          breadcrumbs={[{ label: 'Payslips', href: '/portal/self-service/payslips' }, { label: period }]}
          title={`Payslip for ${period}`}
          actions={<PrintButton pdfHref={`/portal/self-service/payslips/${line.id}/pdf`} />}
        />
      </div>

      <article className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 print:max-w-none print:border-0 print:p-0 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <LogoMark size={36} title="PayCompass" />
            <div>
              <p className="text-lg font-semibold">{config?.companyName ?? 'PayCompass'}</p>
              {config?.address && <p className="text-sm text-muted-foreground">{config.address}</p>}
              {config?.taxId && <p className="text-xs text-muted-foreground">Employer TIN {config.taxId}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-subtlest">PAYSLIP</p>
            <p className="text-base font-semibold">{period}</p>
            {line.payrollRun.paidAt && (
              <p className="text-xs text-muted-foreground">Paid {line.payrollRun.paidAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            )}
          </div>
        </header>

        <dl className="grid gap-x-8 gap-y-2 border-b border-border py-5 text-sm sm:grid-cols-2">
          {[
            ['Employee', line.employeeName],
            ['Employee ID', line.employeeCode],
            ['Department', line.department],
            ['Position', line.designation ?? '-'],
            ['SSNIT number', line.ssnitNumber ?? '-'],
            ['TIN', line.tin ?? '-'],
            ['Bank', line.bankName ?? '-'],
            ['Account', maskAccount(line.accountNumber)],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-8 py-5 sm:grid-cols-2">
          <section>
            <h2 className="text-xs font-semibold text-subtlest">Earnings</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                <Row label="Basic salary" value={Number(line.baseSalary)} />
                {itemisedAllowances ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed snapshot that never reorders; names can repeat
                  items.allowances.map((item, i) => <Row key={`${item.name}-${i}`} label={item.name} value={item.amount} />)
                ) : (
                  <Row label="Allowances" value={Number(line.allowancesTotal)} />
                )}
                <Row label="Gross pay" value={Number(line.grossIncome)} strong />
              </tbody>
            </table>
          </section>
          <section>
            <h2 className="text-xs font-semibold text-subtlest">Deductions</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                <Row label="SSNIT (employee)" value={Number(line.ssnitEmployee)} negative />
                <Row label="PAYE" value={Number(line.paye)} negative />
                {itemisedDeductions ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed snapshot that never reorders; names can repeat
                  items.deductions.map((item, i) => <Row key={`${item.name}-${i}`} label={item.name} value={item.amount} negative />)
                ) : (
                  <Row label="Other deductions" value={Number(line.deductionsTotal)} negative />
                )}
                <Row label="Total deductions" value={Number(line.totalDeductions)} strong negative />
              </tbody>
            </table>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent px-5 py-4">
          <p className="text-sm font-semibold">Net pay</p>
          <p className="num text-2xl font-semibold text-primary">{formatCurrency(Number(line.netPay))}</p>
        </div>

        <footer className="mt-5 grid gap-1 text-xs text-muted-foreground">
          <p>
            Chargeable income for PAYE: {formatCurrency(Number(line.taxableIncome))}. Your employer also paid {formatCurrency(Number(line.ssnitEmployer))} in SSNIT contributions
            for you.
          </p>
          <p>This payslip was generated by PayCompass. Questions? Contact your payroll or HR administrator.</p>
        </footer>
      </article>
    </div>
  )
}
