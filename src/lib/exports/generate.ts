import type { ReportType } from '@prisma/client'
import { createElement } from 'react'
import { audit, can, type UserAccess } from '@/lib/access'
import { actorName } from '@/lib/audit-format'
import { activeCurrency } from '@/lib/currency'
import { toCsv } from '@/lib/payroll-exports'
import { CONTENT_TYPES, renderPdf } from '@/lib/pdf/render'
import { type TableColumn, TableDocument, type TableRow } from '@/lib/pdf/table-document'
import { prisma } from '@/lib/prisma'
import { loadCompany } from '@/lib/run-document-data'
import { rowsToXlsx } from '@/lib/xlsx'
import { describeFilters, type ExportFilters, filtersToQuery } from './filters'
import type { ExportFormat, ReportContext, ReportDef } from './reports'

/** Above these sizes an export is built in the background and the person is notified when it's ready. */
export const SYNC_ROW_LIMIT = 3000
export const SYNC_PAGE_LIMIT = 120
export const EXPORT_RETENTION_DAYS = 7

export function contextFor(actor: UserAccess, filters: ExportFilters): ReportContext {
  return { filters, canSeePay: can(actor.role, 'salary.view'), canSeeDob: can(actor.role, 'employees.edit'), now: new Date() }
}

/** Rows (or pages, for documents) the export will produce. */
export async function exportSize(report: ReportDef, ctx: ReportContext) {
  return report.kind === 'document' ? report.count(ctx) : (await report.build(ctx)).rows.length
}

export function isLarge(report: ReportDef, size: number) {
  return size > (report.kind === 'document' ? SYNC_PAGE_LIMIT : SYNC_ROW_LIMIT)
}

function headerLabel(column: TableColumn) {
  return column.kind === 'money' ? `${column.label} (${activeCurrency()})` : column.label
}

function tableRows(columns: TableColumn[], rows: TableRow[], totals?: TableRow) {
  const money = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : v)
  const out: (string | number | null)[][] = [columns.map(headerLabel)]
  for (const row of rows) out.push(columns.map((c) => (c.kind === 'money' ? (money(row[c.key]) as string | null) : (row[c.key] ?? null))))
  if (totals)
    out.push(columns.map((c, i) => (i === 0 ? 'TOTAL' : totals[c.key] === undefined ? '' : c.kind === 'money' ? (money(totals[c.key]) as string) : (totals[c.key] ?? ''))))
  return out
}

export function exportFilename(report: ReportDef, format: ExportFormat, now = new Date()) {
  return `paycompass-${report.key}-${now.toISOString().slice(0, 10)}.${format}`
}

export async function generateExport(report: ReportDef, ctx: ReportContext, format: ExportFormat, actor: UserAccess) {
  const filtersText = describeFilters(ctx.filters, { usesPeriod: report.usesPeriod, usesYear: report.usesYear, canSeePay: ctx.canSeePay })
  const meta = async () => ({ company: await loadCompany(), generatedBy: actorName(actor), generatedAt: ctx.now, draft: false })

  if (report.kind === 'document') {
    const pdf = await renderPdf(await report.render(ctx, await meta()))
    return { body: pdf, rowCount: await report.count(ctx), contentType: CONTENT_TYPES.pdf, filename: exportFilename(report, 'pdf', ctx.now) }
  }

  const table = await report.build(ctx)
  let body: Buffer | string
  if (format === 'pdf') {
    body = await renderPdf(
      createElement(TableDocument, {
        meta: await meta(),
        title: report.label,
        filtersText,
        summary: table.summary,
        columns: table.columns,
        rows: table.rows,
        totals: table.totals,
      }),
    )
  } else {
    const rows = tableRows(table.columns, table.rows, table.totals)
    body = format === 'xlsx' ? await rowsToXlsx([{ name: report.label, rows: [[report.label], [filtersText], [], ...rows] }]) : toCsv([[report.label], [filtersText], [], ...rows])
  }
  return { body, rowCount: table.rows.length, contentType: CONTENT_TYPES[format], filename: exportFilename(report, format, ctx.now) }
}

/** Records a finished download in export history and the audit log. */
export async function recordExport(report: ReportDef, ctx: ReportContext, format: ExportFormat, actor: UserAccess, result: { body: Buffer | string; rowCount: number }) {
  const size = typeof result.body === 'string' ? Buffer.byteLength(result.body) : result.body.length
  const saved = await prisma.report.create({
    data: {
      type: report.reportType as ReportType,
      title: report.label,
      description: describeFilters(ctx.filters, { usesPeriod: report.usesPeriod, usesYear: report.usesYear, canSeePay: ctx.canSeePay }),
      fileFormat: format.toUpperCase(),
      fileSize: BigInt(size),
      rowCount: result.rowCount,
      filters: filtersToQuery(ctx.filters, { report: report.key }),
      generatedById: actor.id,
    },
  })
  await audit({
    userId: actor.id,
    action: 'DOWNLOAD',
    entityType: 'Report',
    entityId: saved.id,
    changes: { report: report.label, format: format.toUpperCase(), rows: result.rowCount, filters: filtersToQuery(ctx.filters) || 'none' },
  })
  return saved
}
