import { createElement } from 'react'
import { actorName } from '@/lib/audit-format'
import { renderPdf } from '@/lib/pdf/render'
import { TaxCertificatesDocument } from '@/lib/pdf/year-documents'
import { prisma } from '@/lib/prisma'
import { loadCompany } from '@/lib/run-document-data'
import { requireSelfServiceEmployee } from '@/lib/self-service'

/** An employee's own annual tax certificate, from paid runs only. */
export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { user, employee } = await requireSelfServiceEmployee()
  if (!employee) return new Response('Your login isn’t linked to an employee record.', { status: 404 })
  const year = Number((await params).year)
  if (!Number.isInteger(year)) return new Response('Choose a tax year.', { status: 400 })

  const lines = await prisma.payrollDetail.findMany({
    where: { employeeId: employee.id, payrollRun: { status: 'PAID', year } },
    include: { payrollRun: { select: { month: true } } },
    orderBy: { payrollRun: { month: 'asc' } },
  })
  if (lines.length === 0) return new Response(`No paid payroll for ${year}.`, { status: 404 })
  const latest = lines[lines.length - 1]

  const pdf = await renderPdf(
    createElement(TaxCertificatesDocument, {
      meta: { company: await loadCompany(), generatedBy: actorName(user), generatedAt: new Date(), draft: false },
      year,
      signatory: 'Payroll department',
      employees: [
        {
          employeeCode: latest.employeeCode,
          employeeName: latest.employeeName,
          designation: latest.designation,
          tin: latest.tin,
          ssnitNumber: latest.ssnitNumber,
          months: lines.map((l) => ({
            month: l.payrollRun.month,
            grossIncome: Number(l.grossIncome),
            ssnitEmployee: Number(l.ssnitEmployee),
            taxableIncome: Number(l.taxableIncome),
            paye: Number(l.paye),
          })),
        },
      ],
    }),
  )
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tax-certificate-${year}-${latest.employeeCode}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
