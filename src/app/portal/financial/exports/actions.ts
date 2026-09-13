'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import type { ReportType } from '@prisma/client'
import { type ActionResult, audit, can, currentUser } from '@/lib/access'
import { describeFilters, filtersToQuery, parseFilters } from '@/lib/exports/filters'
import { contextFor, EXPORT_RETENTION_DAYS, generateExport } from '@/lib/exports/generate'
import { type ExportFormat, findReport } from '@/lib/exports/reports'
import { notify } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

const EXPORTS = '/portal/financial/exports'

/** Builds a large export after responding, stores it for a week and notifies the person when it's ready. */
export async function prepareExportAction(query: string, rawFormat: string): Promise<ActionResult> {
  const actor = await currentUser()
  const params = Object.fromEntries(new URLSearchParams(query))
  const report = findReport(params.report)
  if (!report) return { ok: false, message: 'Choose a report.' }
  if (!actor || !can(actor.role, report.permission)) return { ok: false, message: 'You don’t have permission to export this report.' }

  const format = (report.formats as string[]).includes(rawFormat) ? (rawFormat as ExportFormat) : report.formats[0]
  const ctx = contextFor(actor, parseFilters(params))
  const pending = await prisma.report.create({
    data: {
      type: report.reportType as ReportType,
      title: report.label,
      description: describeFilters(ctx.filters, { usesPeriod: report.usesPeriod, usesYear: report.usesYear, canSeePay: ctx.canSeePay }),
      fileFormat: format.toUpperCase(),
      status: 'PENDING',
      filters: filtersToQuery(ctx.filters, { report: report.key }),
      generatedById: actor.id,
      expiresAt: new Date(Date.now() + EXPORT_RETENTION_DAYS * 86_400_000),
    },
  })

  after(async () => {
    try {
      const result = await generateExport(report, ctx, format, actor)
      const content = new Uint8Array(typeof result.body === 'string' ? Buffer.from(result.body) : result.body)
      await prisma.report.update({ where: { id: pending.id }, data: { status: 'READY', content, fileSize: BigInt(content.length), rowCount: result.rowCount } })
      await audit({ userId: actor.id, action: 'DOWNLOAD', entityType: 'Report', entityId: pending.id, changes: { report: report.label, format: format.toUpperCase(), rows: result.rowCount, background: true } })
      await notify([actor.id], { type: 'EXPORT_READY', title: `Your ${report.label.toLowerCase()} export is ready`, body: `${result.rowCount} ${report.kind === 'document' ? 'pages' : 'rows'}, ${format.toUpperCase()}. It’s kept for ${EXPORT_RETENTION_DAYS} days.`, href: `${EXPORTS}?tab=history` })
    } catch (err) {
      console.error('[exports] background export failed:', err)
      await prisma.report.update({ where: { id: pending.id }, data: { status: 'FAILED', error: err instanceof Error ? err.message.slice(0, 500) : 'Export failed' } })
      await notify([actor.id], { type: 'EXPORT_FAILED', title: `Your ${report.label.toLowerCase()} export failed`, body: 'Try again, or narrow the filters.', href: `${EXPORTS}?tab=history` })
    }
  })

  revalidatePath(EXPORTS)
  return { ok: true, message: 'Preparing your export. We’ll notify you when it’s ready to download.' }
}

export async function saveReportAction(name: string, query: string): Promise<ActionResult> {
  const actor = await currentUser()
  if (!actor) return { ok: false, message: 'Sign in to save reports.' }
  const params = Object.fromEntries(new URLSearchParams(query))
  const report = findReport(params.report)
  if (!report || !can(actor.role, report.permission)) return { ok: false, message: 'Choose a report you can export.' }
  const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (cleanName.length < 2) return { ok: false, message: 'Give the report a name.' }

  const existing = await prisma.savedReport.count({ where: { createdById: actor.id } })
  if (existing >= 30) return { ok: false, message: 'You can save up to 30 reports. Delete one first.' }
  await prisma.savedReport.create({ data: { name: cleanName, reportType: report.key, filters: filtersToQuery(parseFilters(params)), createdById: actor.id } })
  revalidatePath(EXPORTS)
  return { ok: true, message: `Saved “${cleanName}”.` }
}

export async function deleteSavedReportAction(id: string): Promise<ActionResult> {
  const actor = await currentUser()
  if (!actor) return { ok: false, message: 'Sign in to manage saved reports.' }
  const { count } = await prisma.savedReport.deleteMany({ where: { id, createdById: actor.id } })
  revalidatePath(EXPORTS)
  return count ? { ok: true, message: 'Saved report deleted.' } : { ok: false, message: 'That saved report no longer exists.' }
}
