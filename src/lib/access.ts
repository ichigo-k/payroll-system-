import type { AuditAction } from '@prisma/client'
import { auth } from '@/lib/auth-config'
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

export async function audit(entry: {
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  changes?: Record<string, unknown>
}) {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes ? JSON.stringify(entry.changes) : undefined,
    },
  })
}
