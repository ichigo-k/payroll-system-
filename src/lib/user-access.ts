import { prisma } from '@/lib/prisma'
import type { RoleName } from '@/lib/roles'

export type UserAccess = {
  id: string
  email: string
  role: RoleName
  status: string
  firstName: string | null
  lastName: string | null
  employeeId: string | null
}

// Short in-process cache so every request doesn't hit the database. Role changes and deactivation
// invalidate it immediately on this server; other instances pick changes up within the TTL.
const ACCESS_TTL_MS = 30_000
const cache = new Map<string, { value: UserAccess | null; at: number }>()

export async function getUserAccess(userId: string): Promise<UserAccess | null> {
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < ACCESS_TTL_MS) return hit.value

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true, firstName: true, lastName: true, employee: { select: { id: true } } },
  })
  const value: UserAccess | null = user
    ? { id: user.id, email: user.email, role: user.role, status: user.status, firstName: user.firstName, lastName: user.lastName, employeeId: user.employee?.id ?? null }
    : null
  cache.set(userId, { value, at: Date.now() })
  return value
}

export function invalidateUserAccess(userId: string) {
  cache.delete(userId)
}
