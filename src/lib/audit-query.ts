import type { AuditAction, Prisma } from '@prisma/client'
import { ACTION_LABELS, ENTITY_LABELS } from './audit-format'

export type AuditFilters = { user?: string; action?: string; entity?: string; from?: string; to?: string; q?: string }

const str = (v: string | string[] | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export function readAuditFilters(raw: Record<string, string | string[] | undefined>): AuditFilters {
  return { user: str(raw.user), action: str(raw.action), entity: str(raw.entity), from: str(raw.from), to: str(raw.to), q: str(raw.q) }
}

/** Builds the Prisma filter shared by the audit log page and its CSV export. */
export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = []
  if (f.user) and.push({ userId: f.user })
  if (f.action && f.action in ACTION_LABELS) and.push({ action: f.action as AuditAction })
  if (f.entity && f.entity in ENTITY_LABELS) and.push({ entityType: f.entity })
  const from = f.from ? new Date(`${f.from}T00:00:00`) : null
  const to = f.to ? new Date(`${f.to}T23:59:59.999`) : null
  if (from && !Number.isNaN(from.getTime())) and.push({ timestamp: { gte: from } })
  if (to && !Number.isNaN(to.getTime())) and.push({ timestamp: { lte: to } })
  if (f.q) {
    and.push({
      OR: [
        { changes: { contains: f.q, mode: 'insensitive' } },
        { entityId: { contains: f.q } },
        { ipAddress: { contains: f.q } },
        { user: { OR: [{ email: { contains: f.q, mode: 'insensitive' } }, { firstName: { contains: f.q, mode: 'insensitive' } }, { lastName: { contains: f.q, mode: 'insensitive' } }] } },
      ],
    })
  }
  return and.length ? { AND: and } : {}
}
