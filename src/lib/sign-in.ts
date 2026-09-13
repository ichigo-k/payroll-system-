import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { invalidateUserAccess } from '@/lib/user-access'
import { signInEligibility } from '@/lib/user-rules'

/**
 * Self-service sign-in. Everyone on payroll can sign in with the email on their employee record;
 * no invite is needed. Their login is created on the first successful sign-in.
 *
 * Deliberately doesn't import `@/lib/access` (which imports auth-config) to avoid a cycle.
 */

async function lookup(email: string) {
  const [user, employee] = await Promise.all([
    prisma.user.findUnique({ where: { email }, include: { employee: { select: { id: true } } } }),
    prisma.employee.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true, employmentStatus: true, userId: true },
    }),
  ])
  return { user, employee }
}

/** Whether a sign-in code should be emailed to this address. */
export async function canRequestSignIn(email: string) {
  const { user, employee } = await lookup(email)
  return signInEligibility({ user, employee }) !== 'denied'
}

/**
 * Called after a valid one-time code. Returns the user to sign in, or null if access is refused.
 * Creates the login for first-time employees, and links finance users to their own employee
 * record when the emails match, so they get a self-service area too.
 */
export async function resolveAccountAfterCode(email: string) {
  const { user, employee } = await lookup(email)
  const eligibility = signInEligibility({ user, employee })
  if (eligibility === 'denied') return null

  if (eligibility === 'existing-user' && user) {
    if (!user.employee && employee && !employee.userId) {
      await prisma.employee.update({ where: { id: employee.id }, data: { userId: user.id } })
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'Employee',
          entityId: employee.id,
          changes: JSON.stringify({ userId: { from: null, to: user.id }, reason: 'Linked by matching email at sign-in' }),
        },
      })
      invalidateUserAccess(user.id)
    }
    return user
  }

  if (!employee) return null
  try {
    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, firstName: employee.firstName, lastName: employee.lastName, role: 'EMPLOYEE', status: 'active' },
      })
      await tx.employee.update({ where: { id: employee.id }, data: { userId: newUser.id } })
      await tx.auditLog.create({
        data: {
          userId: newUser.id,
          action: 'CREATE',
          entityType: 'User',
          entityId: newUser.id,
          changes: JSON.stringify({ role: 'EMPLOYEE', employeeId: employee.id, reason: 'Created at first self-service sign-in' }),
        },
      })
      return newUser
    })
    return created
  } catch (err) {
    // Two sign-ins racing for the same person: the other one created the login, so use it
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.user.findUnique({ where: { email } })
      return existing?.status === 'active' ? existing : null
    }
    throw err
  }
}
