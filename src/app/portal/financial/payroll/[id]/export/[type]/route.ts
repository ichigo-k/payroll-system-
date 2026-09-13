import type { ReportType } from '@prisma/client'
import { audit, requirePermission } from '@/lib/access'
import { buildExport, EXPORT_TYPES, type ExportType, exportFilename } from '@/lib/payroll-exports'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
  const actor = await requirePermission('reports.export')
  if (!actor) return new Response('You don’t have permission to export payroll documents.', { status: 403 })

  const { id, type } = await params
  if (!(type in EXPORT_TYPES)) return new Response('Unknown document type.', { status: 404 })
  const exportType = type as ExportType
  const meta = EXPORT_TYPES[exportType]

  const run = await prisma.payrollRun.findUnique({ where: { id }, include: { payrollDetails: { orderBy: { employeeName: 'asc' } } } })
  if (!run) return new Response('Payroll run not found.', { status: 404 })
  // Payment files are only released for approved runs, so nobody can pay an unapproved payroll
  if (meta.requiresApproval && run.status !== 'APPROVED' && run.status !== 'PAID') {
    return new Response('The bank payment schedule is available once the run is approved.', { status: 409 })
  }

  const config = await prisma.systemConfig.findFirst({ where: { isActive: true } })
  const company = {
    companyName: config?.companyName ?? 'PayCompass',
    taxId: config?.taxId ?? null,
    employerSsnitNumber: config?.employerSsnitNumber ?? null,
    bankName: config?.bankName ?? null,
    bankAccountNumber: config?.bankAccountNumber ?? null,
  }

  const lines = run.payrollDetails.map((d) => ({
    employeeCode: d.employeeCode,
    employeeName: d.employeeName,
    department: d.department,
    designation: d.designation,
    bankName: d.bankName,
    accountName: d.accountName,
    accountNumber: d.accountNumber,
    ssnitNumber: d.ssnitNumber,
    tin: d.tin,
    baseSalary: Number(d.baseSalary),
    allowancesTotal: Number(d.allowancesTotal),
    grossIncome: Number(d.grossIncome),
    ssnitEmployee: Number(d.ssnitEmployee),
    ssnitEmployer: Number(d.ssnitEmployer),
    reliefs: Number(d.reliefs),
    taxableIncome: Number(d.taxableIncome),
    paye: Number(d.paye),
    deductionsTotal: Number(d.deductionsTotal),
    totalDeductions: Number(d.totalDeductions),
    netPay: Number(d.netPay),
  }))

  const csv = buildExport(exportType, run, lines, company)
  const filename = exportFilename(exportType, run, company)

  await prisma.report.create({
    data: {
      type: meta.reportType as ReportType,
      payrollRunId: run.id,
      title: `${meta.label}, ${periodLabel(run.month, run.year)}`,
      fileFormat: 'CSV',
      fileSize: BigInt(Buffer.byteLength(csv)),
      generatedById: actor.id,
      description: run.status === 'APPROVED' || run.status === 'PAID' ? null : `Exported while ${run.status.toLowerCase()}`,
    },
  })
  await audit({ userId: actor.id, action: 'DOWNLOAD', entityType: 'PayrollRun', entityId: run.id, changes: { document: meta.label, status: run.status, rows: lines.length } })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
