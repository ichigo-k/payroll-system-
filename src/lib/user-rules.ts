import type { RoleName } from './roles'

/**
 * Pure access-management rules. No database access here so they are easy to unit test;
 * server actions gather the facts and call these before writing anything.
 */

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

type Target = { id: string; role: RoleName; status: string }

export function checkRoleChange({
  actorId,
  target,
  newRole,
  otherActiveAdmins,
}: {
  actorId: string
  target: Target
  newRole: RoleName
  /** Active admins excluding the target */
  otherActiveAdmins: number
}): string | null {
  if (target.id === actorId) return 'You can’t change your own role. Ask another administrator.'
  if (target.role === newRole) return 'This user already has that role.'
  if (target.role === 'ADMIN' && target.status === 'active' && otherActiveAdmins === 0) {
    return 'This is the only active administrator. Make someone else an administrator first.'
  }
  return null
}

export function checkStatusChange({
  actorId,
  target,
  newStatus,
  otherActiveAdmins,
}: {
  actorId: string
  target: Target
  newStatus: 'active' | 'inactive'
  otherActiveAdmins: number
}): string | null {
  if (target.id === actorId) return 'You can’t deactivate your own account.'
  if (target.status === newStatus) return newStatus === 'active' ? 'This user is already active.' : 'This user is already deactivated.'
  if (newStatus === 'inactive' && target.role === 'ADMIN' && otherActiveAdmins === 0) {
    return 'This is the only active administrator. Make someone else an administrator first.'
  }
  return null
}

export function checkEmployeeLink({
  employeeUserId,
  targetUserId,
  userAlreadyLinkedEmployeeId,
}: {
  /** userId currently on the employee record, if any */
  employeeUserId: string | null
  targetUserId: string
  /** employee already linked to the target user, if any */
  userAlreadyLinkedEmployeeId: string | null
}): string | null {
  if (employeeUserId && employeeUserId !== targetUserId) return 'That employee is already linked to another user.'
  if (employeeUserId === targetUserId) return 'That employee is already linked to this user.'
  if (userAlreadyLinkedEmployeeId) return 'This user is already linked to an employee. Unlink them first.'
  return null
}

/**
 * Who may sign in with an email address:
 * - an existing active user (any role)
 * - anyone on payroll without a login yet (their account is created on first sign-in),
 *   unless their employment has been terminated
 * A deactivated user is always refused, which is how admins block self-service.
 */
export function signInEligibility({
  user,
  employee,
}: {
  user: { status: string } | null
  employee: { employmentStatus: string; userId: string | null } | null
}): 'existing-user' | 'provision-employee' | 'denied' {
  if (user) return user.status === 'active' ? 'existing-user' : 'denied'
  if (!employee || employee.userId) return 'denied'
  return employee.employmentStatus === 'TERMINATED' ? 'denied' : 'provision-employee'
}

/** Invited = has an active account but has never signed in. */
export function accessState(user: { status: string; lastLogin: Date | null } | null) {
  if (!user) return 'none' as const
  if (user.status !== 'active') return 'deactivated' as const
  return user.lastLogin ? ('active' as const) : ('invited' as const)
}

/** Self-service status for someone on payroll. Everyone can sign in unless blocked or terminated. */
export function selfServiceState(employee: { employmentStatus: string; user: { status: string; lastLogin: Date | null } | null }) {
  if (employee.user && employee.user.status !== 'active') return 'blocked' as const
  if (employee.employmentStatus === 'TERMINATED') return 'unavailable' as const
  return employee.user?.lastLogin ? ('signed-in' as const) : ('available' as const)
}
