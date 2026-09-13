import { describe, expect, it } from 'vitest'
import { formatEmployeeId, nextEmployeeNumber } from './employee-ids'

describe('employee IDs', () => {
  it('formats with a prefix and zero padding', () => {
    expect(formatEmployeeId(7)).toBe('EMP-0007')
    expect(formatEmployeeId(12345)).toBe('EMP-12345')
  })

  it('continues after the highest existing number, whatever the old format', () => {
    expect(nextEmployeeNumber(['EMP001', 'EMP-001', 'EMP004', 'E17'])).toBe(18)
    expect(nextEmployeeNumber(['CONTRACTOR', 'EMP-0009'])).toBe(10)
  })

  it('starts at 1 when there are no employees', () => {
    expect(nextEmployeeNumber([])).toBe(1)
  })
})
