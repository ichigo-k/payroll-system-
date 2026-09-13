import { type ActionResult, audit, invalidateUserAccess, type UserAccess } from '@/lib/access'
import { checkDelete, checkOffboard, checkReinstate } from '@/lib/employee-rules'
import { notify, userIdsWithRoles } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { ROLE_INFO } from '@/lib/roles'

/**
 * Offboarding, reinstating and deleting employees. Callers check `employees.edit` (administrators) first.
 * Every change is audited, and approvers hear about leavers before the next run.
 */

const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const nameOf = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`
const href = (id: string) => `/portal/financial/employees/${id}`

export async function offboardEmployee(actor: UserAccess, employeeId: string, input: { endDate: string; reason: string; note?: string }): Promise<ActionResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: { select: { id: true, role: true, status: true } } } })
  if (!employee) return { ok: false, message: 'That employee no longer exists.' }
  const endDate = input.endDate ? new Date(input.endDate) : null
  const error = checkOffboard({ actorEmployeeId: actor.employeeId, employee, endDate, reason: input.reason })
  if (error || !endDate) return { ok: false, message: error ?? 'Choose their last working day.' }

  // Leavers lose workspace access straight away. Keep at least one active administrator.
  const workspaceRole = employee.user && employee.user.role !== 'EMPLOYEE' ? employee.user.role : null
  if (workspaceRole === 'ADMIN' && employee.user?.status === 'active') {
    const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'active', id: { not: employee.user.id } } })
    if (otherAdmins === 0) return { ok: false, message: 'This person is the only active administrator. Make someone else an administrator first.' }
  }

  const note = input.note?.trim().slice(0, 300) || undefined
  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employee.id }, data: { employmentStatus: 'TERMINATED', endDate } })
    // Salaries stop on the last working day; later scheduled salaries never start
    await tx.salaryConfiguration.updateMany({ where: { employeeId: employee.id, effectiveFrom: { lte: endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: endDate } }] }, data: { effectiveTo: endDate } })
    await tx.deduction.updateMany({ where: { employeeId: employee.id, isActive: true, OR: [{ endDate: null }, { endDate: { gt: endDate } }] }, data: { endDate } })
    await audit(
      {
        userId: actor.id,
        action: 'UPDATE',
        entityType: 'Employee',
        entityId: employee.id,
        changes: { offboarded: true, employmentStatus: { from: employee.employmentStatus, to: 'TERMINATED' }, endDate: input.endDate, reason: input.reason, note },
      },
      tx,
    )
    if (workspaceRole && employee.user) {
      await tx.user.update({ where: { id: employee.user.id }, data: { role: 'EMPLOYEE' } })
      await audit({ userId: actor.id, action: 'UPDATE', entityType: 'User', entityId: employee.user.id, changes: { role: { from: workspaceRole, to: 'EMPLOYEE' }, reason: 'Offboarded' } }, tx)
    }
  })
  if (employee.user) invalidateUserAccess(employee.user.id)

  const name = nameOf(employee)
  await notify(await userIdsWithRoles(['APPROVER', 'PREPARER'], [actor.id]), {
    type: 'EMPLOYEE_OFFBOARDED',
    title: `${name} is leaving on ${day(endDate)}`,
    body: `${input.reason}. Their final pay is worked out for the days they worked that month.`,
    href: href(employee.id),
  })
  if (workspaceRole) {
    await notify(await userIdsWithRoles(['ADMIN'], [actor.id]), {
      type: 'EMPLOYEE_OFFBOARDED',
      title: `${name}’s ${ROLE_INFO[workspaceRole].label.toLowerCase()} access was removed`,
      body: 'They were offboarded, so their workspace access ended automatically.',
      href: href(employee.id),
    })
  }
  return { ok: true, message: `${name} was offboarded. Their last working day is ${day(endDate)}.${workspaceRole ? ' Their workspace access was removed.' : ''}` }
}

export async function reinstateEmployee(actor: UserAccess, employeeId: string, input: { note?: string }): Promise<ActionResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return { ok: false, message: 'That employee no longer exists.' }
  const error = checkReinstate({ actorEmployeeId: actor.employeeId, employee })
  if (error) return { ok: false, message: error }

  await prisma.employee.update({ where: { id: employee.id }, data: { employmentStatus: 'ACTIVE', endDate: null } })
  await audit({
    userId: actor.id,
    action: 'UPDATE',
    entityType: 'Employee',
    entityId: employee.id,
    changes: { reinstated: true, employmentStatus: { from: 'TERMINATED', to: 'ACTIVE' }, endDate: { from: employee.endDate?.toISOString().slice(0, 10) ?? null, to: null }, note: input.note?.trim() || undefined },
  })
  await notify(await userIdsWithRoles(['APPROVER', 'PREPARER'], [actor.id]), {
    type: 'EMPLOYEE_REINSTATED',
    title: `${nameOf(employee)} was reinstated`,
    body: 'They’ll be included in payroll again once a salary is set.',
    href: href(employee.id),
  })
  return { ok: true, message: `${nameOf(employee)} is active again. Set their salary so they’re included in payroll.` }
}

/** Permanently removes a record added by mistake. Only possible before the person appears in any payroll run. */
export async function deleteEmployee(actor: UserAccess, employeeId: string): Promise<ActionResult> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { select: { id: true, role: true, status: true } }, _count: { select: { payrollDetails: true, salaryConfigs: true, allowances: true, deductions: true } } },
  })
  if (!employee) return { ok: false, message: 'That employee no longer exists.' }
  const workspaceRole = employee.user && employee.user.role !== 'EMPLOYEE' ? employee.user.role : null
  const error = checkDelete({ actorEmployeeId: actor.employeeId, employee, payrollLines: employee._count.payrollDetails, workspaceRole })
  if (error) return { ok: false, message: error }

  await prisma.$transaction(async (tx) => {
    // The self-service login can't be deleted (audit entries point at it), so it's switched off
    if (employee.user) {
      await tx.user.update({ where: { id: employee.user.id }, data: { status: 'inactive' } })
      await tx.otpToken.updateMany({ where: { email: employee.email, consumedAt: null }, data: { consumedAt: new Date() } })
    }
    await tx.employee.delete({ where: { id: employee.id } })
    await audit(
      {
        userId: actor.id,
        action: 'DELETE',
        entityType: 'Employee',
        entityId: employee.id,
        changes: {
          name: nameOf(employee),
          employeeId: employee.employeeId,
          email: employee.email,
          department: employee.department,
          startDate: employee.startDate.toISOString().slice(0, 10),
          removed: { salaries: employee._count.salaryConfigs, allowances: employee._count.allowances, deductions: employee._count.deductions },
        },
      },
      tx,
    )
  })
  if (employee.user) invalidateUserAccess(employee.user.id)

  await notify(await userIdsWithRoles(['APPROVER'], [actor.id]), {
    type: 'EMPLOYEE_DELETED',
    title: `${nameOf(employee)} (${employee.employeeId}) was deleted`,
    body: 'The record was removed before they were ever paid. The audit log keeps a copy of the details.',
    href: '/portal/financial/audit',
  })
  return { ok: true, message: `Deleted ${nameOf(employee)}.` }
}
