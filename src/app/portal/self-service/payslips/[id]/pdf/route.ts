import { createElement } from 'react'
import { actorName } from '@/lib/audit-format'
import { renderPdf } from '@/lib/pdf/render'
import { PayslipsDocument } from '@/lib/pdf/run-documents'
import { prisma } from '@/lib/prisma'
import { loadRunDocumentData } from '@/lib/run-document-data'
import { requireSelfServiceEmployee } from '@/lib/self-service'

/** An employee's own payslip as a PDF, only once the run has been paid. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, employee } = await requireSelfServiceEmployee()
  if (!employee) return new Response('Your login isn’t linked to an employee record.', { status: 404 })
  const { id } = await params

  const detail = await prisma.payrollDetail.findFirst({ where: { id, employeeId: employee.id, payrollRun: { status: 'PAID' } }, select: { payrollRunId: true, employeeCode: true } })
  if (!detail) return new Response('Payslip not found.', { status: 404 })
  const data = await loadRunDocumentData(detail.payrollRunId)
  if (!data) return new Response('Payslip not found.', { status: 404 })

  // Only this employee's line ever leaves the server
  const lines = data.lines.filter((line) => line.employeeCode === detail.employeeCode)
  const pdf = await renderPdf(createElement(PayslipsDocument, { meta: { company: data.company, generatedBy: actorName(user), generatedAt: new Date(), draft: false }, run: data.info, lines }))
  const filename = `payslip-${data.run.year}-${String(data.run.month).padStart(2, '0')}-${detail.employeeCode}.pdf`
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' },
  })
}
