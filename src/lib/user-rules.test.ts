import { describe, expect, it } from 'vitest'
import { accessState, checkEmployeeLink, checkRoleChange, checkStatusChange, normalizeEmail, selfServiceState, signInEligibility } from './user-rules'

const admin = { id: 'admin-1', role: 'ADMIN' as const, status: 'active' }
const preparer = { id: 'prep-1', role: 'PREPARER' as const, status: 'active' }

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ama.Mensah@Company.COM ')).toBe('ama.mensah@company.com')
  })
})

describe('checkRoleChange', () => {
  it('blocks changing your own role', () => {
    expect(checkRoleChange({ actorId: 'admin-1', target: admin, newRole: 'PREPARER', otherActiveAdmins: 3 })).toMatch(/own role/)
  })

  it('blocks demoting the last active admin', () => {
    expect(checkRoleChange({ actorId: 'someone', target: admin, newRole: 'APPROVER', otherActiveAdmins: 0 })).toMatch(/only active administrator/)
  })

  it('allows demoting an admin when another admin remains', () => {
    expect(checkRoleChange({ actorId: 'someone', target: admin, newRole: 'APPROVER', otherActiveAdmins: 1 })).toBeNull()
  })

  it('rejects a no-op change', () => {
    expect(checkRoleChange({ actorId: 'admin-1', target: preparer, newRole: 'PREPARER', otherActiveAdmins: 1 })).toMatch(/already has/)
  })

  it('allows escalating an employee to preparer', () => {
    const employee = { id: 'emp-1', role: 'EMPLOYEE' as const, status: 'active' }
    expect(checkRoleChange({ actorId: 'admin-1', target: employee, newRole: 'PREPARER', otherActiveAdmins: 0 })).toBeNull()
  })
})

describe('checkStatusChange', () => {
  it('blocks deactivating yourself', () => {
    expect(checkStatusChange({ actorId: 'admin-1', target: admin, newStatus: 'inactive', otherActiveAdmins: 2 })).toMatch(/your own account/)
  })

  it('blocks deactivating the last active admin', () => {
    expect(checkStatusChange({ actorId: 'someone', target: admin, newStatus: 'inactive', otherActiveAdmins: 0 })).toMatch(/only active administrator/)
  })

  it('allows reactivating a deactivated admin even when they would be the only one', () => {
    expect(checkStatusChange({ actorId: 'someone', target: { ...admin, status: 'inactive' }, newStatus: 'active', otherActiveAdmins: 0 })).toBeNull()
  })

  it('allows deactivating a preparer', () => {
    expect(checkStatusChange({ actorId: 'admin-1', target: preparer, newStatus: 'inactive', otherActiveAdmins: 0 })).toBeNull()
  })
})

describe('checkEmployeeLink', () => {
  it('blocks linking an employee that belongs to someone else', () => {
    expect(checkEmployeeLink({ employeeUserId: 'other', targetUserId: 'u1', userAlreadyLinkedEmployeeId: null })).toMatch(/another user/)
  })

  it('blocks linking a second employee to the same user', () => {
    expect(checkEmployeeLink({ employeeUserId: null, targetUserId: 'u1', userAlreadyLinkedEmployeeId: 'e9' })).toMatch(/already linked to an employee/)
  })

  it('allows linking a free employee to an unlinked user', () => {
    expect(checkEmployeeLink({ employeeUserId: null, targetUserId: 'u1', userAlreadyLinkedEmployeeId: null })).toBeNull()
  })
})

describe('accessState', () => {
  it('derives access from status and sign-in history', () => {
    expect(accessState(null)).toBe('none')
    expect(accessState({ status: 'inactive', lastLogin: new Date() })).toBe('deactivated')
    expect(accessState({ status: 'active', lastLogin: null })).toBe('invited')
    expect(accessState({ status: 'active', lastLogin: new Date() })).toBe('active')
  })
})

describe('signInEligibility', () => {
  const onPayroll = { employmentStatus: 'ACTIVE', userId: null }

  it('lets anyone on payroll sign in without an invite', () => {
    expect(signInEligibility({ user: null, employee: onPayroll })).toBe('provision-employee')
  })

  it('lets suspended or inactive employees still reach their pay records', () => {
    expect(signInEligibility({ user: null, employee: { employmentStatus: 'SUSPENDED', userId: null } })).toBe('provision-employee')
  })

  it('refuses terminated employees without a login', () => {
    expect(signInEligibility({ user: null, employee: { employmentStatus: 'TERMINATED', userId: null } })).toBe('denied')
  })

  it('refuses unknown emails', () => {
    expect(signInEligibility({ user: null, employee: null })).toBe('denied')
  })

  it('uses the existing login when there is one, and refuses it when blocked', () => {
    expect(signInEligibility({ user: { status: 'active' }, employee: onPayroll })).toBe('existing-user')
    expect(signInEligibility({ user: { status: 'inactive' }, employee: onPayroll })).toBe('denied')
  })
})

describe('selfServiceState', () => {
  it('reports blocked, unavailable, signed in and available', () => {
    expect(selfServiceState({ employmentStatus: 'ACTIVE', user: { status: 'inactive', lastLogin: null } })).toBe('blocked')
    expect(selfServiceState({ employmentStatus: 'TERMINATED', user: null })).toBe('unavailable')
    expect(selfServiceState({ employmentStatus: 'ACTIVE', user: { status: 'active', lastLogin: new Date() } })).toBe('signed-in')
    expect(selfServiceState({ employmentStatus: 'ACTIVE', user: null })).toBe('available')
  })
})
