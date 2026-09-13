import type { Prisma } from '@prisma/client'
import { countryName } from '@/lib/countries'
import { genderLabel } from '@/lib/people'

/**
 * Export centre filters. They live in the URL (so a filtered report can be bookmarked, shared or
 * saved) and are turned into Prisma queries here, so preview and download always agree.
 */

export type ExportFilters = {
  departments: string[]
  status: 'active' | 'left' | 'all'
  gender: string
  nationality: string
  ageMin: number | null
  ageMax: number | null
  serviceMin: number | null
  serviceMax: number | null
  joinedFrom: string
  joinedTo: string
  leftFrom: string
  leftTo: string
  salaryMin: number | null
  salaryMax: number | null
  missing: string
  /** Pay period range as YYYY-MM */
  from: string
  to: string
  /** For yearly documents */
  year: number | null
}

export const MISSING_OPTIONS = [
  { value: 'dob', label: 'Date of birth' },
  { value: 'ssnit', label: 'SSNIT number' },
  { value: 'tin', label: 'TIN' },
  { value: 'bank', label: 'Bank details' },
] as const

type Raw = Record<string, string | string[] | undefined>
const one = (raw: Raw, key: string) => {
  const value = raw[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}
const int = (raw: Raw, key: string, min: number, max: number) => {
  const text = one(raw, key)
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null
}
const isoDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()) ? value : '')
const isoMonth = (value: string) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : '')

export function parseFilters(raw: Raw): ExportFilters {
  const status = one(raw, 'status')
  const departments = (Array.isArray(raw.department) ? raw.department : one(raw, 'department').split(','))
    .map((d) => d.trim())
    .filter(Boolean)
  const from = isoMonth(one(raw, 'from'))
  const to = isoMonth(one(raw, 'to'))
  return {
    departments: [...new Set(departments)],
    status: status === 'left' || status === 'all' ? status : 'active',
    gender: ['MALE', 'FEMALE', 'OTHER'].includes(one(raw, 'gender')) ? one(raw, 'gender') : '',
    nationality: /^[A-Z]{2}$/.test(one(raw, 'nationality')) ? one(raw, 'nationality') : '',
    ageMin: int(raw, 'ageMin', 0, 120),
    ageMax: int(raw, 'ageMax', 0, 120),
    serviceMin: int(raw, 'serviceMin', 0, 80),
    serviceMax: int(raw, 'serviceMax', 0, 80),
    joinedFrom: isoDate(one(raw, 'joinedFrom')),
    joinedTo: isoDate(one(raw, 'joinedTo')),
    leftFrom: isoDate(one(raw, 'leftFrom')),
    leftTo: isoDate(one(raw, 'leftTo')),
    salaryMin: int(raw, 'salaryMin', 0, 100_000_000),
    salaryMax: int(raw, 'salaryMax', 0, 100_000_000),
    missing: MISSING_OPTIONS.some((m) => m.value === one(raw, 'missing')) ? one(raw, 'missing') : '',
    // Keep the range the right way round
    from: from && to && from > to ? to : from,
    to: from && to && from > to ? from : to,
    year: int(raw, 'year', 2000, 2100),
  }
}

/** Filters back to a query string, leaving out defaults so links stay short. */
export function filtersToQuery(filters: ExportFilters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra)
  if (filters.departments.length) params.set('department', filters.departments.join(','))
  if (filters.status !== 'active') params.set('status', filters.status)
  for (const key of ['gender', 'nationality', 'joinedFrom', 'joinedTo', 'leftFrom', 'leftTo', 'missing', 'from', 'to'] as const) {
    if (filters[key]) params.set(key, filters[key])
  }
  for (const key of ['ageMin', 'ageMax', 'serviceMin', 'serviceMax', 'salaryMin', 'salaryMax', 'year'] as const) {
    if (filters[key] !== null) params.set(key, String(filters[key]))
  }
  return params.toString()
}

const yearsAgo = (years: number, now: Date) => new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
const dayAfter = (date: Date) => new Date(date.getTime() + 86_400_000)

/** Which employees a report covers. Pay filters only apply for people allowed to see pay. */
export function employeeWhere(filters: ExportFilters, { canSeePay, now = new Date() }: { canSeePay: boolean; now?: Date }): Prisma.EmployeeWhereInput {
  const and: Prisma.EmployeeWhereInput[] = []
  if (filters.departments.length) and.push({ department: { in: filters.departments } })
  if (filters.status === 'active') and.push({ employmentStatus: { not: 'TERMINATED' } })
  if (filters.status === 'left') and.push({ employmentStatus: 'TERMINATED' })
  if (filters.gender) and.push({ gender: filters.gender })
  if (filters.nationality) and.push({ nationality: filters.nationality })
  // At least N years old: born on or before this day N years ago. At most N: born after the day N+1 years ago.
  if (filters.ageMin !== null) and.push({ dateOfBirth: { lte: yearsAgo(filters.ageMin, now) } })
  if (filters.ageMax !== null) and.push({ dateOfBirth: { gt: yearsAgo(filters.ageMax + 1, now) } })
  if (filters.serviceMin !== null) and.push({ startDate: { lte: yearsAgo(filters.serviceMin, now) } })
  if (filters.serviceMax !== null) and.push({ startDate: { gt: yearsAgo(filters.serviceMax + 1, now) } })
  if (filters.joinedFrom) and.push({ startDate: { gte: new Date(filters.joinedFrom) } })
  if (filters.joinedTo) and.push({ startDate: { lt: dayAfter(new Date(filters.joinedTo)) } })
  if (filters.leftFrom) and.push({ endDate: { gte: new Date(filters.leftFrom) } })
  if (filters.leftTo) and.push({ endDate: { lt: dayAfter(new Date(filters.leftTo)) } })
  if (filters.missing === 'dob') and.push({ dateOfBirth: null })
  if (filters.missing === 'ssnit') and.push({ ssnit_number: null })
  if (filters.missing === 'tin') and.push({ tin: null })
  if (filters.missing === 'bank') and.push({ OR: [{ bankName: null }, { accountNumber: null }] })
  if (canSeePay && (filters.salaryMin !== null || filters.salaryMax !== null)) {
    and.push({
      salaryConfigs: {
        some: {
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          baseSalary: { ...(filters.salaryMin !== null && { gte: filters.salaryMin }), ...(filters.salaryMax !== null && { lte: filters.salaryMax }) },
        },
      },
    })
  }
  return and.length ? { AND: and } : {}
}

/** Pay period range as inclusive year/month bounds, defaulting to the current year so far. */
export function periodRange(filters: ExportFilters, now = new Date()) {
  const [fy, fm] = (filters.from || `${now.getUTCFullYear()}-01`).split('-').map(Number)
  const [ty, tm] = (filters.to || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`).split('-').map(Number)
  return { from: { year: fy, month: fm }, to: { year: ty, month: tm } }
}

export function runPeriodWhere(filters: ExportFilters, now = new Date()): Prisma.PayrollRunWhereInput {
  const { from, to } = periodRange(filters, now)
  return {
    AND: [
      { OR: [{ year: { gt: from.year } }, { year: from.year, month: { gte: from.month } }] },
      { OR: [{ year: { lt: to.year } }, { year: to.year, month: { lte: to.month } }] },
    ],
  }
}

const monthLabel = (ym: { year: number; month: number }) => new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Plain-English summary of the filters, printed on documents and shown above the preview. */
export function describeFilters(filters: ExportFilters, { usesPeriod, usesYear, canSeePay }: { usesPeriod?: boolean; usesYear?: boolean; canSeePay?: boolean } = {}) {
  const parts: string[] = []
  parts.push(filters.status === 'active' ? 'Current employees' : filters.status === 'left' ? 'Employees who have left' : 'Current and former employees')
  if (filters.departments.length) parts.push(`in ${filters.departments.join(', ')}`)
  if (filters.gender) parts.push(genderLabel(filters.gender).toLowerCase())
  if (filters.nationality) parts.push(`nationality ${countryName(filters.nationality)}`)
  const range = (min: number | null, max: number | null, unit: string) =>
    min !== null && max !== null ? `${min} to ${max} ${unit}` : min !== null ? `at least ${min} ${unit}` : max !== null ? `at most ${max} ${unit}` : ''
  const age = range(filters.ageMin, filters.ageMax, 'years old')
  if (age) parts.push(`aged ${age}`)
  const service = range(filters.serviceMin, filters.serviceMax, 'years of service')
  if (service) parts.push(`with ${service}`)
  if (filters.joinedFrom || filters.joinedTo) parts.push(`joined ${filters.joinedFrom ? `from ${filters.joinedFrom}` : ''}${filters.joinedFrom && filters.joinedTo ? ' ' : ''}${filters.joinedTo ? `to ${filters.joinedTo}` : ''}`)
  if (filters.leftFrom || filters.leftTo) parts.push(`left ${filters.leftFrom ? `from ${filters.leftFrom}` : ''}${filters.leftFrom && filters.leftTo ? ' ' : ''}${filters.leftTo ? `to ${filters.leftTo}` : ''}`)
  if (canSeePay) {
    const salary = range(filters.salaryMin, filters.salaryMax, 'basic salary')
    if (salary) parts.push(`earning ${salary}`)
  }
  if (filters.missing) parts.push(`missing ${MISSING_OPTIONS.find((m) => m.value === filters.missing)?.label.toLowerCase()}`)
  let text = parts.join(', ')
  if (usesPeriod) {
    const { from, to } = periodRange(filters)
    text += `. Pay periods ${monthLabel(from)} to ${monthLabel(to)}`
  }
  if (usesYear) text += `. Tax year ${filters.year ?? new Date().getUTCFullYear()}`
  return `${text}.`
}
