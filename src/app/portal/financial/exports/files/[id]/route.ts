import { audit, currentUser } from '@/lib/access'
import { CONTENT_TYPES } from '@/lib/pdf/render'
import { prisma } from '@/lib/prisma'

/** A background export someone prepared. Only the person who asked for it can download it, until it expires. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser()
  if (!actor) return new Response('Sign in to download exports.', { status: 401 })
  const { id } = await params

  const report = await prisma.report.findFirst({
    where: { id, generatedById: actor.id },
    select: { id: true, title: true, status: true, content: true, fileFormat: true, expiresAt: true, generatedAt: true },
  })
  if (!report || report.status !== 'READY' || !report.content) return new Response('That export isn’t available.', { status: 404 })
  if (report.expiresAt && report.expiresAt < new Date()) return new Response('That export has expired. Run it again from the export centre.', { status: 410 })

  const format = report.fileFormat.toLowerCase() as keyof typeof CONTENT_TYPES
  const filename = `paycompass-${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${report.generatedAt.toISOString().slice(0, 10)}.${format}`
  await audit({ userId: actor.id, action: 'DOWNLOAD', entityType: 'Report', entityId: report.id, changes: { report: report.title, format: report.fileFormat, prepared: true } })
  return new Response(new Uint8Array(report.content), {
    headers: { 'Content-Type': CONTENT_TYPES[format] ?? 'application/octet-stream', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  })
}
