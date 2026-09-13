import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { type ActionResult, audit, invalidateUserAccess, type UserAccess } from '@/lib/access'
import { sendAccessStatusEmail, sendInviteEmail, sendRoleChangedEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { isFinancialRole, ROLE_INFO, ROLES, type RoleName } from '@/lib/roles'
import { checkEmployeeLink, checkRoleChange, checkStatusChange, normalizeEmail } from '@/lib/user-rules'

/**
 * User management operations. Callers must already have checked the actor is an active admin
 * (see requireRole). Every write is audited and clears the access cache for the affected user.
 */

function displayName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

async function trySend(send: () => Promise<void>, context: string) {
  try {
    await send()
    return true
  } catch (err) {
    console.error(`[users] ${context} email failed:`, err)
    return false
  }
}

function otherActiveAdmins(excludeUserId: string) {
  return prisma.user.count({ where: { role: 'ADMIN', status: 'active', id: { not: excludeUserId } } })
}

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  role: z.enum(ROLES, { message: 'Choose a role.' }),
  employeeId: z.string().trim().optional(),
})

export async function inviteUser(actor: UserAccess, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  const email = normalizeEmail(parsed.data.email)
  const role = parsed.data.role
  if (role === 'EMPLOYEE') {
    return { ok: false, message: 'Employees don’t need an invite. Anyone on payroll can sign in with the email on their employee record.' }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return {
      ok: false,
      message: existing.status === 'active' ? 'Someone with this email already has access.' : 'This email belongs to a deactivated user. Reactivate them instead.',
    }
  }

  // Link the chosen employee, or an unlinked employee with the same email
  const employee = parsed.data.employeeId
    ? await prisma.employee.findUnique({ where: { id: parsed.data.employeeId } })
    : await prisma.employee.findFirst({ where: { email, userId: null } })
  if (parsed.data.employeeId && !employee) return { ok: false, message: 'That employee record no longer exists.' }
  if (employee?.userId) return { ok: false, message: 'That employee is already linked to another user.' }

  const firstName = parsed.data.firstName || employee?.firstName || null
  const lastName = parsed.data.lastName || employee?.lastName || null

  let userId: string
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, firstName, lastName, role, status: 'active' } })
      if (employee) await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id } })
      return user.id
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, message: 'Someone with this email already has access.' }
    }
    throw err
  }

  await audit({ userId: actor.id, action: 'CREATE', entityType: 'User', entityId: userId, changes: { email, role, linkedEmployeeId: employee?.id ?? null } })

  const sent = await trySend(() => sendInviteEmail({ to: email, firstName, role, invitedBy: displayName(actor) }), 'invite')
  const who = firstName ? `${firstName}${lastName ? ` ${lastName}` : ''}` : email
  const linked = employee ? ` and linked to ${employee.firstName} ${employee.lastName}’s employee record` : ''
  return sent
    ? { ok: true, message: `Invited ${who} as ${ROLE_INFO[role].label.toLowerCase()}${linked}.` }
    : { ok: true, message: `${who} was added${linked}, but the invite email didn’t send. Use “Resend invite” to try again.` }
}

export async function changeUserRole(actor: UserAccess, userId: string, newRole: string): Promise<ActionResult> {
  if (!(ROLES as readonly string[]).includes(newRole)) return { ok: false, message: 'Choose a valid role.' }
  const role = newRole as RoleName
  const target = await prisma.user.findUnique({ where: { id: userId }, include: { employee: { select: { id: true } } } })
  if (!target) return { ok: false, message: 'That user no longer exists.' }

  const error = checkRoleChange({ actorId: actor.id, target, newRole: role, otherActiveAdmins: await otherActiveAdmins(target.id) })
  if (error) return { ok: false, message: error }
  if (role === 'EMPLOYEE' && !target.employee) {
    return { ok: false, message: 'Link this user to an employee record before making them an employee.' }
  }

  await prisma.user.update({ where: { id: target.id }, data: { role } })
  invalidateUserAccess(target.id)
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'User', entityId: target.id, changes: { role: { from: target.role, to: role } } })

  if (target.status === 'active') {
    await trySend(() => sendRoleChangedEmail({ to: target.email, firstName: target.firstName, from: target.role, toRole: role, changedBy: displayName(actor) }), 'role change')
  }
  return { ok: true, message: `${displayName(target)} is now ${ROLE_INFO[role].label.toLowerCase()}.` }
}

export async function setUserStatus(actor: UserAccess, userId: string, newStatus: 'active' | 'inactive'): Promise<ActionResult> {
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return { ok: false, message: 'That user no longer exists.' }

  const error = checkStatusChange({ actorId: actor.id, target, newStatus, otherActiveAdmins: await otherActiveAdmins(target.id) })
  if (error) return { ok: false, message: error }

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { status: newStatus } }),
    // Any codes issued before deactivation stop working immediately
    ...(newStatus === 'inactive' ? [prisma.otpToken.updateMany({ where: { email: target.email, consumedAt: null }, data: { consumedAt: new Date() } })] : []),
  ])
  invalidateUserAccess(target.id)
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'User', entityId: target.id, changes: { status: { from: target.status, to: newStatus } } })

  await trySend(() => sendAccessStatusEmail({ to: target.email, firstName: target.firstName, active: newStatus === 'active', changedBy: displayName(actor) }), 'status change')
  return {
    ok: true,
    message: newStatus === 'active' ? `${displayName(target)} can sign in again.` : `${displayName(target)} has been deactivated and signed out.`,
  }
}

export async function resendInvite(actor: UserAccess, userId: string): Promise<ActionResult> {
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return { ok: false, message: 'That user no longer exists.' }
  if (target.status !== 'active') return { ok: false, message: 'Reactivate this user before sending an invite.' }

  const sent = await trySend(() => sendInviteEmail({ to: target.email, firstName: target.firstName, role: target.role, invitedBy: displayName(actor) }), 'resend invite')
  if (!sent) return { ok: false, message: 'The invite email didn’t send. Check the email settings and try again.' }
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'User', entityId: target.id, changes: { inviteResent: true } })
  return { ok: true, message: `Invite sent to ${target.email}.` }
}

export async function linkEmployee(actor: UserAccess, userId: string, employeeId: string): Promise<ActionResult> {
  const [target, employee] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { employee: { select: { id: true } } } }),
    prisma.employee.findUnique({ where: { id: employeeId } }),
  ])
  if (!target) return { ok: false, message: 'That user no longer exists.' }
  if (!employee) return { ok: false, message: 'That employee record no longer exists.' }

  const error = checkEmployeeLink({ employeeUserId: employee.userId, targetUserId: target.id, userAlreadyLinkedEmployeeId: target.employee?.id ?? null })
  if (error) return { ok: false, message: error }

  await prisma.employee.update({ where: { id: employee.id }, data: { userId: target.id } })
  invalidateUserAccess(target.id)
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'Employee', entityId: employee.id, changes: { userId: { from: null, to: target.id } } })
  return { ok: true, message: `${displayName(target)} is now linked to ${employee.firstName} ${employee.lastName}’s employee record.` }
}

export async function unlinkEmployee(actor: UserAccess, userId: string): Promise<ActionResult> {
  const target = await prisma.user.findUnique({ where: { id: userId }, include: { employee: true } })
  if (!target) return { ok: false, message: 'That user no longer exists.' }
  if (!target.employee) return { ok: false, message: 'This user isn’t linked to an employee record.' }
  if (target.role === 'EMPLOYEE') {
    return { ok: false, message: 'Employee logins need an employee record. Deactivate the user instead.' }
  }

  await prisma.employee.update({ where: { id: target.employee.id }, data: { userId: null } })
  invalidateUserAccess(target.id)
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'Employee', entityId: target.employee.id, changes: { userId: { from: target.id, to: null } } })
  return { ok: true, message: `${displayName(target)} is no longer linked to an employee record.` }
}

/**
 * From the Employees page: email someone on payroll how to reach their payslips.
 * Optional, since employees can sign in without it; useful for rollout announcements.
 */
export async function sendSelfServiceWelcome(actor: UserAccess, employeeId: string): Promise<ActionResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: { select: { status: true } } } })
  if (!employee) return { ok: false, message: 'That employee record no longer exists.' }
  if (employee.user && employee.user.status !== 'active') return { ok: false, message: 'Self-service is blocked for this employee. Unblock them first.' }
  if (employee.employmentStatus === 'TERMINATED') return { ok: false, message: 'Terminated employees can’t sign in to self-service.' }

  const sent = await trySend(() => sendInviteEmail({ to: employee.email, firstName: employee.firstName, role: 'EMPLOYEE', invitedBy: displayName(actor) }), 'self-service welcome')
  if (!sent) return { ok: false, message: 'The email didn’t send. Check the email settings and try again.' }
  await audit({ userId: actor.id, action: 'UPDATE', entityType: 'Employee', entityId: employee.id, changes: { selfServiceWelcomeSent: true } })
  return { ok: true, message: `Sent sign-in instructions to ${employee.email}.` }
}

/** Stops an employee signing in to self-service. Creates a blocked login if they never signed in. */
export async function blockSelfService(actor: UserAccess, employeeId: string): Promise<ActionResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: { select: { id: true, role: true, status: true } } } })
  if (!employee) return { ok: false, message: 'That employee record no longer exists.' }

  if (employee.user) {
    if (employee.user.role !== 'EMPLOYEE') {
      // Blocking here would also remove their finance access, so send them to User management
      return { ok: false, message: `This person is also a ${ROLE_INFO[employee.user.role].label.toLowerCase()}. Change their access in User management.` }
    }
    return setUserStatus(actor, employee.user.id, 'inactive')
  }

  const email = normalizeEmail(employee.email)
  const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (clash) return { ok: false, message: 'Another login already uses this email. Manage it in User management.' }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email, firstName: employee.firstName, lastName: employee.lastName, role: 'EMPLOYEE', status: 'inactive' } })
    await tx.employee.update({ where: { id: employee.id }, data: { userId: created.id } })
    await tx.otpToken.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } })
    return created
  })
  await audit({
    userId: actor.id,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    changes: { status: { from: null, to: 'inactive' }, reason: 'Self-service blocked from Employees page' },
  })
  return { ok: true, message: `${employee.firstName} ${employee.lastName} can no longer sign in to self-service.` }
}

export async function unblockSelfService(actor: UserAccess, employeeId: string): Promise<ActionResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { user: { select: { id: true, status: true } } } })
  if (!employee?.user || employee.user.status === 'active') return { ok: false, message: 'Self-service isn’t blocked for this employee.' }
  return setUserStatus(actor, employee.user.id, 'active')
}

/**
 * From the Employees page: give someone on payroll a finance role (admin, preparer or approver),
 * or change the one they have. Their login stays linked to their employee record, so they keep self-service.
 */
export async function grantWorkspaceRole(actor: UserAccess, employeeId: string, newRole: string): Promise<ActionResult> {
  if (!isFinancialRole(newRole)) return { ok: false, message: 'Choose administrator, payroll preparer or payroll approver.' }
  const role = newRole as RoleName
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } })
  if (!employee) return { ok: false, message: 'That employee record no longer exists.' }
  if (employee.employmentStatus === 'TERMINATED') return { ok: false, message: 'Terminated employees can’t be given workspace access.' }

  if (employee.user) {
    if (employee.user.status !== 'active') return { ok: false, message: 'This person’s access is blocked. Unblock them before changing their role.' }
    return changeUserRole(actor, employee.user.id, role)
  }

  // A login may already exist under the same email without being linked
  const email = normalizeEmail(employee.email)
  const existing = await prisma.user.findUnique({ where: { email }, include: { employee: { select: { id: true } } } })
  if (existing) {
    if (existing.employee) return { ok: false, message: 'Another employee record already uses this login. Check User management.' }
    const linked = await linkEmployee(actor, existing.id, employee.id)
    if (!linked.ok) return linked
    return existing.role === role
      ? { ok: true, message: `${employee.firstName} already had this role. Their login is now linked to their employee record.` }
      : changeUserRole(actor, existing.id, role)
  }

  // First time: create the login with the role, linked to the record, and send the workspace invite
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, firstName: employee.firstName, lastName: employee.lastName, role, status: 'active' } })
    await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id } })
    return user
  })
  await audit({
    userId: actor.id,
    action: 'CREATE',
    entityType: 'User',
    entityId: created.id,
    changes: { role, employeeId: employee.id, reason: 'Workspace access given from Employees page' },
  })
  const sent = await trySend(() => sendInviteEmail({ to: email, firstName: employee.firstName, role, invitedBy: displayName(actor) }), 'workspace access')
  const who = `${employee.firstName} ${employee.lastName}`
  return sent
    ? { ok: true, message: `${who} is now ${ROLE_INFO[role].label.toLowerCase()}. We’ve emailed them how to sign in.` }
    : { ok: true, message: `${who} is now ${ROLE_INFO[role].label.toLowerCase()}, but the email didn’t send.` }
}

/** From the Employees page: remove the finance role but keep self-service access to their own pay. */
export async function removeWorkspaceAccess(actor: UserAccess, employeeId: string): Promise<ActionResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { user: { select: { id: true, role: true } } } })
  if (!employee?.user || employee.user.role === 'EMPLOYEE') return { ok: false, message: 'This person doesn’t have workspace access.' }
  return changeUserRole(actor, employee.user.id, 'EMPLOYEE')
}
