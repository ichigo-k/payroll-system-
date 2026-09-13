import { can, currentUser } from '@/lib/access'
import { parseFilters } from '@/lib/exports/filters'
import { contextFor, exportSize, generateExport, isLarge, recordExport } from '@/lib/exports/generate'
import { type ExportFormat, findReport } from '@/lib/exports/reports'

/** Downloads an export centre report straight away. Large ones must be prepared in the background. */
export async function GET(request: Request) {
  const actor = await currentUser()
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const report = findReport(params.report)
  if (!report) return new Response('Choose a report.', { status: 404 })
  if (!actor || !can(actor.role, report.permission)) return new Response('You don’t have permission to export this report.', { status: 403 })

  const format = (report.formats as string[]).includes(params.format) ? (params.format as ExportFormat) : report.formats[0]
  const ctx = contextFor(actor, parseFilters(params))
  if (isLarge(report, await exportSize(report, ctx))) {
    return new Response('This export is too large to download directly. Use “Prepare in background” and you’ll be notified when it’s ready.', { status: 413 })
  }

  const result = await generateExport(report, ctx, format, actor)
  await recordExport(report, ctx, format, actor, result)
  return new Response(typeof result.body === 'string' ? result.body : new Uint8Array(result.body), {
    headers: {
      'Content-Type': result.contentType,
      'Content-Disposition': `${format === 'pdf' && params.inline ? 'inline' : 'attachment'}; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
