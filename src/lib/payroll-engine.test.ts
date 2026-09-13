import { describe, expect, it } from 'vitest'
import { activeInPeriod, calculateLine, periodBounds, progressiveTax, prorationFactor, reviewFlags } from './payroll-engine'
import { approvalsRemaining, checkDecision, checkMarkPaid, checkRecall, checkSubmit, effectiveTaxConfig } from './payroll-rules'

const brackets = [
  { min: 0, max: 490, rate: 0 },
  { min: 490, max: 600, rate: 0.05 },
  { min: 600, max: 730, rate: 0.1 },
  { min: 730, max: 3896.67, rate: 0.175 },
  { min: 3896.67, max: 99_999_999, rate: 0.25 },
]

describe('progressiveTax', () => {
  it('charges each band only on the income inside it', () => {
    expect(progressiveTax(400, brackets)).toBe(0)
    expect(progressiveTax(600, brackets)).toBe(5.5) // 110 x 5%
    expect(progressiveTax(1000, brackets)).toBe(65.75) // 5.5 + 13 + 270 x 17.5%
  })
})

describe('calculateLine', () => {
  it('deducts SSNIT before PAYE and computes net pay', () => {
    const line = calculateLine({
      baseSalary: 3000,
      allowances: [
        { amount: 500, frequency: 'monthly' },
        { amount: 1200, frequency: 'annual' },
      ],
      deductions: [100],
      brackets,
      ssnitEmployeeRate: 5.5,
      ssnitEmployerRate: 13,
      reliefs: 0,
    })
    expect(line.allowancesTotal).toBe(600)
    expect(line.grossIncome).toBe(3600)
    expect(line.ssnitEmployee).toBe(165)
    expect(line.ssnitEmployer).toBe(390)
    expect(line.taxableIncome).toBe(3435)
    expect(line.paye).toBe(progressiveTax(3435, brackets))
    expect(line.netPay).toBe(Math.round((3600 - 165 - line.paye - 100) * 100) / 100)
  })

  it('never produces negative net pay', () => {
    const line = calculateLine({ baseSalary: 100, allowances: [], deductions: [5000], brackets, ssnitEmployeeRate: 5.5, ssnitEmployerRate: 13, reliefs: 0 })
    expect(line.netPay).toBe(0)
  })
})

describe('reviewFlags', () => {
  const base = { baseSalary: 3000, netPay: 2500, bankName: 'GCB', accountNumber: '123', ssnitNumber: 'C1', tin: 'GHA-1' }

  it('flags new employees and missing statutory details', () => {
    expect(reviewFlags({ ...base, ssnitNumber: null, tin: null }, null)).toEqual(['NEW_EMPLOYEE', 'MISSING_SSNIT', 'MISSING_TIN'])
  })

  it('flags salary, bank and large net pay changes against the previous run', () => {
    const flags = reviewFlags({ ...base, baseSalary: 4000, netPay: 3200, accountNumber: '999' }, { baseSalary: 3000, netPay: 2500, bankName: 'GCB', accountNumber: '123' })
    expect(flags).toEqual(['SALARY_CHANGED', 'BANK_CHANGED', 'NET_PAY_JUMP'])
  })
})

describe('period helpers', () => {
  it('checks date ranges overlap the pay period', () => {
    const { start, end } = periodBounds(2026, 9)
    expect(activeInPeriod({ from: new Date('2026-09-15') }, start, end)).toBe(true)
    expect(activeInPeriod({ from: new Date('2026-10-01') }, start, end)).toBe(false)
    expect(activeInPeriod({ to: new Date('2026-08-31') }, start, end)).toBe(false)
  })
})

describe('prorationFactor', () => {
  const { start, end } = periodBounds(2026, 9) // 30 days

  it('pays the whole month to people employed throughout', () => {
    expect(prorationFactor({ startDate: new Date('2024-01-01') }, start, end)).toBe(1)
  })

  it('pays joiners and leavers for the calendar days they were employed', () => {
    expect(prorationFactor({ startDate: new Date('2026-09-16') }, start, end)).toBe(0.5)
    expect(prorationFactor({ startDate: new Date('2024-01-01'), endDate: new Date('2026-09-15') }, start, end)).toBe(0.5)
    expect(prorationFactor({ startDate: new Date('2026-09-01'), endDate: new Date('2026-09-30') }, start, end)).toBe(1)
    expect(prorationFactor({ startDate: new Date('2024-01-01'), endDate: new Date('2026-08-31') }, start, end)).toBe(0)
  })
})

describe('effectiveTaxConfig', () => {
  const approved = new Date('2026-01-01')
  const config = (id: string, year: number, month: number, extra: { isActive?: boolean; approvedAt?: Date | null } = {}) => ({
    id,
    year,
    month,
    isActive: true,
    approvedAt: approved,
    ...extra,
  })

  it('carries the latest approved configuration forward into later years', () => {
    expect(effectiveTaxConfig([config('2024', 2024, 0)], 2026, 9)?.id).toBe('2024')
  })

  it('prefers the newest one that has started, and a month-specific one over the whole year', () => {
    const configs = [config('2024', 2024, 0), config('2026', 2026, 0), config('2026-07', 2026, 7), config('2026-12', 2026, 12)]
    expect(effectiveTaxConfig(configs, 2026, 9)?.id).toBe('2026-07')
    expect(effectiveTaxConfig(configs, 2026, 3)?.id).toBe('2026')
    expect(effectiveTaxConfig(configs, 2025, 5)?.id).toBe('2024')
  })

  it('ignores drafts, inactive and future configurations', () => {
    expect(effectiveTaxConfig([config('draft', 2026, 0, { approvedAt: null }), config('off', 2025, 0, { isActive: false }), config('future', 2027, 0)], 2026, 9)).toBeNull()
  })
})

describe('payroll rules', () => {
  it('only submits drafts with employees and approved tax settings', () => {
    expect(checkSubmit({ status: 'DRAFT', headcount: 3, hasActiveTax: true })).toBeNull()
    expect(checkSubmit({ status: 'DRAFT', headcount: 0, hasActiveTax: true })).toMatch(/no employees/)
    expect(checkSubmit({ status: 'DRAFT', headcount: 3, hasActiveTax: false })).toMatch(/tax configuration/)
    expect(checkSubmit({ status: 'SUBMITTED', headcount: 3, hasActiveTax: true })).toMatch(/draft/)
  })

  it('stops recall once an approval exists', () => {
    expect(checkRecall({ status: 'SUBMITTED', approvalsThisRound: 0 })).toBeNull()
    expect(checkRecall({ status: 'SUBMITTED', approvalsThisRound: 1 })).toMatch(/already approved/)
  })

  it('enforces maker-checker and the own-pay rule', () => {
    const base = { status: 'SUBMITTED' as const, approverId: 'a1', submittedById: 'p1', alreadyDecided: false, ownPayChanged: false }
    expect(checkDecision(base)).toBeNull()
    expect(checkDecision({ ...base, submittedById: 'a1' })).toMatch(/someone else/)
    expect(checkDecision({ ...base, alreadyDecided: true })).toMatch(/already reviewed/)
    expect(checkDecision({ ...base, ownPayChanged: true })).toMatch(/your own pay/)
    expect(checkDecision({ ...base, status: 'DRAFT' })).toMatch(/isn’t waiting/)
  })

  it('counts approvals against the policy', () => {
    expect(approvalsRemaining(2, 1)).toBe(1)
    expect(approvalsRemaining(1, 1)).toBe(0)
    expect(approvalsRemaining(0, 0)).toBe(1)
  })

  it('only marks approved runs as paid', () => {
    expect(checkMarkPaid({ status: 'APPROVED' })).toBeNull()
    expect(checkMarkPaid({ status: 'SUBMITTED' })).toMatch(/approved/)
  })
})
