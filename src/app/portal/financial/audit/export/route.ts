import { audit, requirePermission } from '@/lib/access'
import { ACTION_LABELS, actorName, ENTITY_LABELS } from '@/lib/audit-format'
import { auditWhere, readAuditFilters } from '@/lib/audit-query'
import { csvCell } from '@/lib/payroll-exports'
import { prisma } from '@/lib/prisma'

const MAX_ROWS = 50_000

export async function GET(request: Request) {
  const actor = await requirePermission('audit.view')
  if (!actor) return new Response('You don’t have permission to export the audit log.', { status: 403 })

  const url = new URL(request.url)
  const filters = readAuditFilters(Object.fromEntries(url.searchParams))
  const rows = await prisma.auditLog.findMany({
    where: auditWhere(filters),
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { timestamp: 'desc' },
    take: MAX_ROWS,
  })

  const lines = [
    ['Timestamp (UTC)', 'Person', 'Email', 'Action', 'Record type', 'Record ID', 'IP address', 'Device', 'Details'],
    ...rows.map((row) => [
      row.timestamp.toISOString(),
      actorName(row.user),
      row.user.email,
      ACTION_LABELS[row.action] ?? row.action,
      ENTITY_LABELS[row.entityType] ?? row.entityType,
      row.entityId,
      row.ipAddress ?? '',
      row.userAgent ?? '',
      row.changes ?? '',
    ]),
  ]
  const csv = `﻿${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`

  // Exporting the audit log is itself audited
  await audit({ userId: actor.id, action: 'DOWNLOAD', entityType: 'AuditLog', entityId: 'export', changes: { rows: rows.length, filters } })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
