import type { TaxBracket } from './types'

/**
 * Monthly payroll calculation for Ghana.
 *
 * - SSNIT is charged on basic salary: employee share deducted from pay, employer share paid on top.
 * - Chargeable income = basic + allowances - employee SSNIT - reliefs.
 * - PAYE is charged on chargeable income using the monthly bands in the active tax configuration.
 * - Net pay = gross - employee SSNIT - PAYE - other deductions (never below zero).
 *
 * Rates and bands come from configuration; confirm them against current GRA and SSNIT guidance.
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export type AllowanceInput = { amount: number; frequency: string }

export type LineInput = {
  baseSalary: number
  allowances: AllowanceInput[]
  deductions: number[]
  brackets: TaxBracket[]
  ssnitEmployeeRate: number // percent, e.g. 5.5
  ssnitEmployerRate: number // percent, e.g. 13
  reliefs: number
}

export type LineResult = {
  baseSalary: number
  allowancesTotal: number
  grossIncome: number
  ssnitEmployee: number
  ssnitEmployer: number
  reliefs: number
  taxableIncome: number
  paye: number
  deductionsTotal: number
  totalDeductions: number
  netPay: number
}

/** Converts an allowance to its monthly amount. One-time amounts are paid in full in the run. */
export function monthlyAmount({ amount, frequency }: AllowanceInput) {
  return frequency === 'annual' ? amount / 12 : amount
}

/** Tax on chargeable income across progressive bands. Bands are [min, max) with rate as a fraction. */
export function progressiveTax(income: number, brackets: TaxBracket[]) {
  let tax = 0
  for (const band of [...brackets].sort((a, b) => a.min - b.min)) {
    if (income <= band.min) break
    tax += (Math.min(income, band.max) - band.min) * band.rate
  }
  return round2(tax)
}

export function calculateLine(input: LineInput): LineResult {
  const baseSalary = round2(input.baseSalary)
  const allowancesTotal = round2(input.allowances.reduce((sum, a) => sum + monthlyAmount(a), 0))
  const grossIncome = round2(baseSalary + allowancesTotal)
  const ssnitEmployee = round2((baseSalary * input.ssnitEmployeeRate) / 100)
  const ssnitEmployer = round2((baseSalary * input.ssnitEmployerRate) / 100)
  const reliefs = round2(Math.max(0, input.reliefs))
  const taxableIncome = round2(Math.max(0, grossIncome - ssnitEmployee - reliefs))
  const paye = progressiveTax(taxableIncome, input.brackets)
  const deductionsTotal = round2(input.deductions.reduce((sum, d) => sum + d, 0))
  const totalDeductions = round2(ssnitEmployee + paye + deductionsTotal)
  const netPay = round2(Math.max(0, grossIncome - totalDeductions))
  return { baseSalary, allowancesTotal, grossIncome, ssnitEmployee, ssnitEmployer, reliefs, taxableIncome, paye, deductionsTotal, totalDeductions, netPay }
}

export const REVIEW_FLAGS = {
  NEW_EMPLOYEE: 'New this period',
  SALARY_CHANGED: 'Basic salary changed',
  BANK_CHANGED: 'Bank details changed',
  NET_PAY_JUMP: 'Net pay changed by more than 20%',
  MISSING_BANK: 'Missing bank details',
  MISSING_SSNIT: 'Missing SSNIT number',
  MISSING_TIN: 'Missing TIN',
  PART_MONTH: 'Part month (joined or leaving)',
  RETIREMENT_AGE: 'Reaching retirement age (60)',
  MISSING_DOB: 'Missing date of birth',
  LEAVER: 'Leaving this period',
} as const
export type ReviewFlag = keyof typeof REVIEW_FLAGS

/** Flags that help an approver spot risky or unusual lines, compared with the previous approved run. */
export function reviewFlags(
  current: { baseSalary: number; netPay: number; bankName: string | null; accountNumber: string | null; ssnitNumber: string | null; tin: string | null },
  previous: { baseSalary: number; netPay: number; bankName: string | null; accountNumber: string | null } | null,
): ReviewFlag[] {
  const flags: ReviewFlag[] = []
  if (!previous) flags.push('NEW_EMPLOYEE')
  else {
    if (round2(previous.baseSalary) !== round2(current.baseSalary)) flags.push('SALARY_CHANGED')
    if ((previous.accountNumber ?? '') !== (current.accountNumber ?? '') || (previous.bankName ?? '') !== (current.bankName ?? '')) flags.push('BANK_CHANGED')
    if (previous.netPay > 0 && Math.abs(current.netPay - previous.netPay) / previous.netPay > 0.2) flags.push('NET_PAY_JUMP')
  }
  if (!current.accountNumber || !current.bankName) flags.push('MISSING_BANK')
  if (!current.ssnitNumber) flags.push('MISSING_SSNIT')
  if (!current.tin) flags.push('MISSING_TIN')
  return flags
}

/** Whether a line applies in the pay period (salary configurations, deductions with date ranges). */
export function activeInPeriod(range: { from?: Date | null; to?: Date | null }, periodStart: Date, periodEnd: Date) {
  return (!range.from || range.from <= periodEnd) && (!range.to || range.to >= periodStart)
}

export function periodBounds(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59)) }
}

/**
 * Share of the month someone is employed, by calendar days, for joiners and leavers.
 * 1 when they're employed for the whole period.
 */
export function prorationFactor(employment: { startDate: Date; endDate?: Date | null }, periodStart: Date, periodEnd: Date) {
  const dayMs = 86_400_000
  const dayOf = (d: Date) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / dayMs)
  const first = dayOf(periodStart)
  const last = dayOf(periodEnd)
  const from = Math.max(first, dayOf(employment.startDate))
  const to = Math.min(last, employment.endDate ? dayOf(employment.endDate) : last)
  if (to < from) return 0
  const factor = (to - from + 1) / (last - first + 1)
  return Math.round(factor * 10_000) / 10_000
}
