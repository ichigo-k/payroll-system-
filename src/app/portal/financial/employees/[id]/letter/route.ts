import { createElement } from 'react'
import { audit, can, currentUser } from '@/lib/access'
import { actorName } from '@/lib/audit-format'
import { renderPdf } from '@/lib/pdf/render'
import { ConfirmationLetterDocument } from '@/lib/pdf/year-documents'
import { prisma } from '@/lib/prisma'
import { ROLE_INFO } from '@/lib/roles'
import { loadCompany } from '@/lib/run-document-data'

/**
 * Employment confirmation letter, for bank loans, visas and tenancy applications. Administrators (HR)
 * and payroll staff can issue it; only people who can see pay can include the salary.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser()
  if (!actor || !(can(actor.role, 'employees.edit') || can(actor.role, 'salary.view'))) return new Response('You can’t issue employment letters.', { status: 403 })
  const { id } = await params
  const query = new URL(request.url).searchParams
  const withSalary = query.get('salary') === '1' && can(actor.role, 'salary.view')

  const now = new Date()
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      salaryConfigs: { where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
      allowances: { where: { isActive: true, frequency: { not: 'one-time' } } },
    },
  })
  if (!employee) return new Response('Employee not found.', { status: 404 })
  if (withSalary && !employee.salaryConfigs[0]) return new Response('This employee has no current salary to include.', { status: 409 })

  const name = `${employee.firstName} ${employee.lastName}`
  const current = employee.employmentStatus !== 'TERMINATED'
  const pdf = await renderPdf(
    createElement(ConfirmationLetterDocument, {
      meta: { company: await loadCompany(), generatedBy: actorName(actor), generatedAt: now, draft: false },
      letter: {
        employeeName: name,
        firstName: employee.firstName,
        employeeCode: employee.employeeId,
        designation: employee.designation,
        department: employee.department,
        startDate: employee.startDate,
        endDate: employee.endDate,
        current,
        addressee: (query.get('to') ?? '').trim().slice(0, 120),
        purpose: (query.get('purpose') ?? '').trim().slice(0, 160),
        salary: withSalary
          ? {
              basic: Number(employee.salaryConfigs[0].baseSalary),
              allowances: Math.round(employee.allowances.reduce((t, a) => t + (a.frequency === 'annual' ? Number(a.amount) / 12 : Number(a.amount)), 0) * 100) / 100,
            }
          : null,
        signatory: { name: actorName(actor), title: ROLE_INFO[actor.role].label },
      },
    }),
  )

  await prisma.report.create({
    data: {
      type: 'CONFIRMATION_LETTER',
      title: `Employment confirmation for ${name}`,
      description: withSalary ? 'Includes salary' : null,
      fileFormat: 'PDF',
      fileSize: BigInt(pdf.length),
      generatedById: actor.id,
    },
  })
  await audit({
    userId: actor.id,
    action: 'DOWNLOAD',
    entityType: 'Employee',
    entityId: employee.id,
    changes: { document: 'Employment confirmation letter', includesSalary: withSalary, addressedTo: query.get('to') || 'To whom it may concern' },
  })

  const filename = `employment-confirmation-${employee.employeeId}-${now.toISOString().slice(0, 10)}.pdf`
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': 'no-store' } })
}
