import type { AllowanceType, DeductionType } from '@prisma/client'

/**
 * Allowances and deductions have free-text names ("Fuel", "Car loan") so payslips read the way the
 * company talks. The name is stored in `description`; `type` keeps a broad category for reporting.
 */

export const ALLOWANCE_SUGGESTIONS = ['Housing', 'Transport', 'Meal', 'Responsibility', 'Fuel', 'Utility', 'Overtime', 'Risk', 'Acting', 'Clothing', 'Medical', 'Bonus']
export const DEDUCTION_SUGGESTIONS = ['Staff loan', 'Salary advance', 'Car loan', 'Provident fund', 'Union dues', 'Welfare', 'Tier 3 pension', 'Canteen', 'Insurance']

const ALLOWANCE_KEYWORDS: [AllowanceType, RegExp][] = [
  ['HOUSING', /hous|rent|accommodation/i],
  ['TRANSPORT', /transport|fuel|car|vehicle|travel|mileage/i],
  ['MEAL', /meal|lunch|food|canteen/i],
  ['RESPONSIBILITY', /responsib|acting|supervis/i],
]

const DEDUCTION_KEYWORDS: [DeductionType, RegExp][] = [
  ['LOAN', /loan|advance/i],
  ['PENSION', /pension|provident|tier/i],
  ['VOLUNTARY', /union|welfare|dues|donation|voluntary|insurance/i],
]

export const MAX_ITEM_NAME = 60

/** Tidies a typed name: collapses spaces, trims, and caps the length. */
export function cleanItemName(raw: string) {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_NAME)
}

export function allowanceTypeFor(name: string): AllowanceType {
  return ALLOWANCE_KEYWORDS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'OTHER'
}

export function deductionTypeFor(name: string): DeductionType {
  return DEDUCTION_KEYWORDS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'OTHER'
}

const TYPE_LABELS: Record<string, string> = {
  HOUSING: 'Housing',
  TRANSPORT: 'Transport',
  MEAL: 'Meal',
  RESPONSIBILITY: 'Responsibility',
  LOAN: 'Loan repayment',
  VOLUNTARY: 'Voluntary deduction',
  PENSION: 'Pension',
}

/** The name shown on screens and payslips. Older records without a name fall back to their category. */
export function payItemName(item: { type: string; description: string | null }, kind: 'allowance' | 'deduction') {
  const name = item.description?.trim()
  if (name) return name
  return TYPE_LABELS[item.type] ?? (kind === 'allowance' ? 'Other allowance' : 'Other deduction')
}

// ---------------------------------------------------------------------------
// Salary changes

export const SALARY_CHANGE_REASONS = ['New hire', 'Promotion', 'Annual increment', 'Market adjustment', 'Cost of living adjustment', 'Probation confirmed', 'Correction', 'Demotion', 'Other'] as const

/** Percentage change between two salaries, rounded to one decimal place. Null when there's no previous salary. */
export function salaryChangePercent(previous: number | null | undefined, next: number) {
  if (!previous || previous <= 0) return null
  return Math.round(((next - previous) / previous) * 1000) / 10
}

export function formatPercentChange(percent: number | null) {
  if (percent === null) return ''
  if (percent === 0) return 'No change'
  return `${percent > 0 ? '+' : ''}${percent.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`
}

// ---------------------------------------------------------------------------
// Payslip line items, snapshotted onto each payroll line when a run is calculated

export type LineItem = { name: string; amount: number }
export type LineItems = { allowances: LineItem[]; deductions: LineItem[] }

export function parseLineItems(json: string | null | undefined): LineItems {
  try {
    const value = JSON.parse(json ?? '{}')
    const list = (items: unknown): LineItem[] =>
      Array.isArray(items) ? items.filter((i): i is LineItem => !!i && typeof i.name === 'string' && typeof i.amount === 'number') : []
    return { allowances: list(value?.allowances), deductions: list(value?.deductions) }
  } catch {
    return { allowances: [], deductions: [] }
  }
}
