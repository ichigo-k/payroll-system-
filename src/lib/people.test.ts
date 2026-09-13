import { describe, expect, it } from 'vitest'
import { findCountryCode, searchCountries } from './countries'
import { ageOn, checkDateOfBirth, nearRetirement, parseGender, yearsOfService } from './people'

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('people', () => {
  it('counts age and service in whole years', () => {
    expect(ageOn(d('1990-09-14'), d('2026-09-13'))).toBe(35)
    expect(ageOn(d('1990-09-13'), d('2026-09-13'))).toBe(36)
    expect(yearsOfService(d('2020-01-01'), null, d('2026-09-13'))).toBe(6)
    expect(yearsOfService(d('2020-01-01'), d('2023-06-30'), d('2026-09-13'))).toBe(3)
  })

  it('flags people reaching 60 within six months', () => {
    expect(nearRetirement(d('1967-01-10'), d('2026-09-13'))).toBe(true)
    expect(nearRetirement(d('1960-01-10'), d('2026-09-13'))).toBe(true)
    expect(nearRetirement(d('1968-01-10'), d('2026-09-13'))).toBe(false)
  })

  it('validates dates of birth', () => {
    const today = d('2026-09-13')
    expect(checkDateOfBirth('', { required: false }, today)).toBeNull()
    expect(checkDateOfBirth('', { required: true }, today)).toMatch(/Enter/)
    expect(checkDateOfBirth('2015-01-01', { required: true }, today)).toMatch(/at least 15/)
    expect(checkDateOfBirth('2030-01-01', { required: true }, today)).toMatch(/future/)
    expect(checkDateOfBirth('1990-05-20', { required: true }, today)).toBeNull()
  })

  it('reads gender from spreadsheets', () => {
    expect(parseGender('M')).toBe('MALE')
    expect(parseGender('female')).toBe('FEMALE')
    expect(parseGender('Other')).toBe('OTHER')
    expect(parseGender('?')).toBeNull()
  })
})

describe('countries', () => {
  it('resolves codes, names and demonyms', () => {
    expect(findCountryCode('gh')).toBe('GH')
    expect(findCountryCode('Ghana')).toBe('GH')
    expect(findCountryCode('Ghanaian')).toBe('GH')
    expect(findCountryCode('Côte d’Ivoire')).toBe('CI')
    expect(findCountryCode('Atlantis')).toBeNull()
  })

  it('searches by the start of the name first', () => {
    expect(searchCountries('gh')[0].code).toBe('GH')
    expect(searchCountries('nig').map((c) => c.code)).toEqual(expect.arrayContaining(['NG', 'NE']))
    expect(searchCountries('nig')[0].code).toBe('NG')
    expect(searchCountries('')).toEqual([])
  })
})
