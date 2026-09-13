import { createElement } from 'react'
import type { ReportType } from '@prisma/client'
import { audit, requirePermission } from '@/lib/access'
import { actorName } from '@/lib/audit-format'
import { buildRows, EXPORT_TYPES, toCsv, type ExportFormat, type ExportType, exportFilename } from '@/lib/payroll-exports'
import { CONTENT_TYPES, renderPdf } from '@/lib/pdf/render'
import { BankInstructionDocument, PayeScheduleDocument, PayslipsDocument, RunSummaryDocument, SsnitScheduleDocument } from '@/lib/pdf/run-documents'
import { prisma } from '@/lib/prisma'
import { loadRunDocumentData } from '@/lib/run-document-data'
import { rowsToXlsx } from '@/lib/xlsx'

const PDFS = { summary: RunSummaryDocument, payslips: PayslipsDocument, bank: BankInstructionDocument, paye: PayeScheduleDocument, ssnit: SsnitScheduleDocument } as const

export async function GET(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
  const actor = await requirePermission('reports.export')
  if (!actor) return new Response('You don’t have permission to export payroll documents.', { status: 403 })

  const { id, type } = await params
  if (!(type in EXPORT_TYPES)) return new Response('Unknown document type.', { status: 404 })
  const exportType = type as ExportType
  const meta = EXPORT_TYPES[exportType]
  const requested = new URL(request.url).searchParams.get('format') as ExportFormat | null
  const format: ExportFormat = requested && meta.formats.includes(requested) ? requested : meta.formats[0]

  const data = await loadRunDocumentData(id)
  if (!data) return new Response('Payroll run not found.', { status: 404 })
  const { run, info, lines, company, exportCompany, approved } = data
  // Payment files are only released for approved runs, so nobody can pay an unapproved payroll
  if (meta.requiresApproval && !approved) {
    return new Response('The bank payment documents are available once the run is approved.', { status: 409 })
  }

  let body: Buffer | string
  if (format === 'pdf') {
    const Component = PDFS[exportType as keyof typeof PDFS]
    if (!Component) return new Response('This document isn’t available as a PDF.', { status: 404 })
    body = await renderPdf(createElement(Component, { meta: { company, generatedBy: actorName(actor), generatedAt: new Date(), draft: !approved }, run: info, lines }))
  } else {
    const rows = buildRows(exportType, run, lines, exportCompany)
    body = format === 'xlsx' ? await rowsToXlsx([{ name: meta.label, rows }]) : toCsv(rows)
  }

  const filename = exportFilename(exportType, run, exportCompany, format)
  await prisma.report.create({
    data: {
      type: meta.reportType as ReportType,
      payrollRunId: run.id,
      title: `${format === 'pdf' && meta.pdfLabel ? `${meta.label} (${meta.pdfLabel.toLowerCase()})` : meta.label}, ${info.period}`,
      fileFormat: format.toUpperCase(),
      fileSize: BigInt(typeof body === 'string' ? Buffer.byteLength(body) : body.length),
      generatedById: actor.id,
      rowCount: lines.length,
      description: approved ? null : `Exported while ${run.status.toLowerCase()}`,
    },
  })
  await audit({ userId: actor.id, action: 'DOWNLOAD', entityType: 'PayrollRun', entityId: run.id, changes: { document: meta.label, format: format.toUpperCase(), status: run.status, rows: lines.length } })

  return new Response(typeof body === 'string' ? body : new Uint8Array(body), {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `${format === 'pdf' && new URL(request.url).searchParams.has('inline') ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

