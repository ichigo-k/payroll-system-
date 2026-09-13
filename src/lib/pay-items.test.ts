import { describe, expect, it } from 'vitest'
import { allowanceTypeFor, cleanItemName, deductionTypeFor, formatPercentChange, parseLineItems, payItemName, salaryChangePercent } from './pay-items'

describe('pay item names', () => {
  it('maps typed names to a reporting category, defaulting to OTHER', () => {
    expect(allowanceTypeFor('Fuel allowance')).toBe('TRANSPORT')
    expect(allowanceTypeFor('Rent support')).toBe('HOUSING')
    expect(allowanceTypeFor('Dragon Reborn')).toBe('OTHER')
    expect(deductionTypeFor('Car loan')).toBe('LOAN')
    expect(deductionTypeFor('Provident fund')).toBe('PENSION')
    expect(deductionTypeFor('Gym')).toBe('OTHER')
  })

  it('cleans whitespace and caps length', () => {
    expect(cleanItemName('  Dragon   Reborn ')).toBe('Dragon Reborn')
    expect(cleanItemName('x'.repeat(100))).toHaveLength(60)
  })

  it('shows the stored name, or the category for older records', () => {
    expect(payItemName({ type: 'OTHER', description: 'Dragon Reborn' }, 'allowance')).toBe('Dragon Reborn')
    expect(payItemName({ type: 'HOUSING', description: null }, 'allowance')).toBe('Housing')
    expect(payItemName({ type: 'OTHER', description: ' ' }, 'deduction')).toBe('Other deduction')
  })
})

describe('salary changes', () => {
  it('works out the percentage change', () => {
    expect(salaryChangePercent(4000, 4600)).toBe(15)
    expect(salaryChangePercent(3000, 2900)).toBe(-3.3)
    expect(salaryChangePercent(null, 5000)).toBeNull()
    expect(formatPercentChange(15)).toBe('+15%')
    expect(formatPercentChange(-3.3)).toBe('-3.3%')
    expect(formatPercentChange(null)).toBe('')
  })
})

describe('parseLineItems', () => {
  it('reads a snapshot and ignores anything malformed', () => {
    expect(parseLineItems('{"allowances":[{"name":"Fuel","amount":600}],"deductions":[{"name":1}]}')).toEqual({ allowances: [{ name: 'Fuel', amount: 600 }], deductions: [] })
    expect(parseLineItems('{}')).toEqual({ allowances: [], deductions: [] })
    expect(parseLineItems('not json')).toEqual({ allowances: [], deductions: [] })
  })
})
