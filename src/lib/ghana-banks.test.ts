import { describe, expect, it } from 'vitest'
import { bankInitials, findGhanaBank, searchGhanaBanks } from './ghana-banks'

describe('Ghana banks', () => {
  it('matches saved names, short names and older spellings', () => {
    expect(findGhanaBank('GCB Bank')?.short).toBe('GCB')
    expect(findGhanaBank('Ghana Commercial Bank')?.short).toBe('GCB')
    expect(findGhanaBank('ecobank ghana ltd')?.short).toBe('Ecobank')
    expect(findGhanaBank('Societe Generale')?.short).toBe('SG')
    expect(findGhanaBank('Some Rural Bank')).toBeNull()
    expect(findGhanaBank('')).toBeNull()
  })

  it('searches as you type', () => {
    expect(searchGhanaBanks('stan').map((b) => b.short)).toEqual(['Stanbic', 'StanChart'])
    expect(searchGhanaBanks('uba').map((b) => b.short)).toEqual(['UBA'])
    expect(searchGhanaBanks('st').map((b) => b.short)).toEqual(['Stanbic', 'StanChart'])
    expect(searchGhanaBanks('ghana commercial').map((b) => b.short)).toEqual(['GCB'])
  })

  it('makes initials for the fallback logo', () => {
    expect(bankInitials('GCB Bank')).toBe('GCB')
    expect(bankInitials('Akuapem Rural Bank')).toBe('AR')
  })
})
