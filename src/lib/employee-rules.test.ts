import { describe, expect, it } from 'vitest'
import { checkDelete, checkOffboard, checkReinstate } from './employee-rules'

const employee = { id: 'e1', employmentStatus: 'ACTIVE', startDate: new Date('2025-01-01') }

describe('checkOffboard', () => {
  it('needs a valid last day and reason', () => {
    expect(checkOffboard({ actorEmployeeId: null, employee, endDate: new Date('2026-09-30'), reason: 'Resignation' })).toBeNull()
    expect(checkOffboard({ actorEmployeeId: null, employee, endDate: null, reason: 'Resignation' })).toMatch(/last working day/)
    expect(checkOffboard({ actorEmployeeId: null, employee, endDate: new Date('2024-12-31'), reason: 'Resignation' })).toMatch(/before their start/)
    expect(checkOffboard({ actorEmployeeId: null, employee, endDate: new Date('2026-09-30'), reason: 'Bored' })).toMatch(/why/)
  })

  it('blocks offboarding yourself or someone who already left', () => {
    expect(checkOffboard({ actorEmployeeId: 'e1', employee, endDate: new Date('2026-09-30'), reason: 'Resignation' })).toMatch(/yourself/)
    expect(checkOffboard({ actorEmployeeId: null, employee: { ...employee, employmentStatus: 'TERMINATED' }, endDate: new Date('2026-09-30'), reason: 'Resignation' })).toMatch(
      /already left/,
    )
  })
})

describe('checkReinstate', () => {
  it('only reinstates leavers', () => {
    expect(checkReinstate({ actorEmployeeId: null, employee: { ...employee, employmentStatus: 'TERMINATED' } })).toBeNull()
    expect(checkReinstate({ actorEmployeeId: null, employee })).toMatch(/Only employees who have left/)
  })
})

describe('checkDelete', () => {
  it('keeps anyone with payroll history or workspace access', () => {
    expect(checkDelete({ actorEmployeeId: null, employee, payrollLines: 0, workspaceRole: null })).toBeNull()
    expect(checkDelete({ actorEmployeeId: null, employee, payrollLines: 2, workspaceRole: null })).toMatch(/Offboard them instead/)
    expect(checkDelete({ actorEmployeeId: null, employee, payrollLines: 0, workspaceRole: 'PREPARER' })).toMatch(/administrator/)
    expect(checkDelete({ actorEmployeeId: 'e1', employee, payrollLines: 0, workspaceRole: null })).toMatch(/your own/)
  })
})
