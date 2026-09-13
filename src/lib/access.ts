import type { AuditAction, Prisma } from '@prisma/client'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth-config'
import { can, PERMISSIONS, type Permission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import type { RoleName } from '@/lib/roles'
import { getUserAccess } from '@/lib/user-access'

export { getUserAccess, invalidateUserAccess, type UserAccess } from '@/lib/user-access'

export type ActionResult = { ok: true; message: string } | { ok: false; message: string }

/** Returns the signed-in, active user if they hold one of the roles; otherwise null. */
export async function requireRole(roles: readonly RoleName[]) {
  const session = await auth()
  if (!session?.user?.id) return null
  const access = await getUserAccess(session.user.id)
  if (!access || access.status !== 'active' || !roles.includes(access.role)) return null
  return access
}

/** Returns the signed-in, active user if their role grants the permission; otherwise null. */
export async function requirePermission(permission: Permission) {
  return requireRole(PERMISSIONS[permission])
}

/** Current user (any role) or null. */
export async function currentUser() {
  const session = await auth()
  if (!session?.user?.id) return null
  const access = await getUserAccess(session.user.id)
  return access && access.status === 'active' ? access : null
}

export { can }

async function requestContext() {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    return { ipAddress: ip, userAgent: h.get('user-agent')?.slice(0, 300) ?? null }
  } catch {
    // Outside a request (scripts, tests)
    return { ipAddress: null, userAgent: null }
  }
}

type AuditEntry = {
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  changes?: Record<string, unknown>
}

/**
 * Appends to the audit log with the caller's IP and device. The table is append-only at the
 * database level, so entries can never be edited or removed. Pass `tx` to write inside a transaction.
 */
export async function audit(entry: AuditEntry, tx?: Prisma.TransactionClient) {
  const context = await requestContext()
  await (tx ?? prisma).auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes ? JSON.stringify(entry.changes) : undefined,
      ...context,
    },
  })
}

/** Field-by-field changes between two records, for audit entries. Only includes fields that changed. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(after)) {
    const from = before[key] instanceof Date ? (before[key] as Date).toISOString().slice(0, 10) : (before[key] ?? null)
    const rawTo = after[key]
    const to = rawTo instanceof Date ? rawTo.toISOString().slice(0, 10) : (rawTo ?? null)
    if (String(from ?? '') !== String(to ?? '')) changes[key] = { from, to }
  }
  return changes
}
