import { describe, expect, it } from 'vitest'
import { describeFilters, employeeWhere, filtersToQuery, parseFilters, periodRange } from './filters'

const now = new Date('2026-09-13T00:00:00Z')

describe('export filters', () => {
  it('parses the URL, ignoring junk and swapping a reversed period', () => {
    const f = parseFilters({ department: 'Finance, IT', status: 'bogus', gender: 'FEMALE', ageMin: '30', ageMax: 'x', from: '2023-12', to: '2022-01', missing: 'nope' })
    expect(f.departments).toEqual(['Finance', 'IT'])
    expect(f.status).toBe('active')
    expect(f.gender).toBe('FEMALE')
    expect(f.ageMin).toBe(30)
    expect(f.ageMax).toBeNull()
    expect([f.from, f.to]).toEqual(['2022-01', '2023-12'])
    expect(f.missing).toBe('')
  })

  it('round-trips through a query string', () => {
    const f = parseFilters({ department: 'HR', status: 'all', serviceMin: '5', from: '2022-01', to: '2023-12' })
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f)
  })

  it('turns age and service into date bounds', () => {
    const where = employeeWhere(parseFilters({ ageMin: '30', serviceMin: '5', status: 'all' }), { canSeePay: false, now })
    expect(where).toEqual({ AND: [{ dateOfBirth: { lte: new Date('1996-09-13T00:00:00Z') } }, { startDate: { lte: new Date('2021-09-13T00:00:00Z') } }] })
  })

  it('only filters by salary for people who can see pay', () => {
    const f = parseFilters({ salaryMin: '3000', status: 'all' })
    expect(employeeWhere(f, { canSeePay: false, now })).toEqual({})
    expect(JSON.stringify(employeeWhere(f, { canSeePay: true, now }))).toContain('"gte":3000')
  })

  it('defaults the period to this year so far and describes the filters', () => {
    expect(periodRange(parseFilters({}), now)).toEqual({ from: { year: 2026, month: 1 }, to: { year: 2026, month: 9 } })
    const text = describeFilters(parseFilters({ department: 'Finance', ageMin: '30', from: '2022-01', to: '2023-12' }), { usesPeriod: true })
    expect(text).toBe('Current employees, in Finance, aged at least 30 years old. Pay periods Jan 2022 to Dec 2023.')
  })
})
