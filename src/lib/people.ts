/** Personal details helpers: gender labels, age, length of service and SSNIT retirement age. */

export const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
] as const

export type Gender = (typeof GENDERS)[number]['value']

export function genderLabel(value: string | null | undefined) {
  return GENDERS.find((g) => g.value === value)?.label ?? ''
}

/** Accepts what people type in spreadsheets: M, male, F, Female, other. */
export function parseGender(raw: string | null | undefined): Gender | null {
  const value = raw?.trim().toLowerCase()
  if (!value) return null
  if (['m', 'male', 'man'].includes(value)) return 'MALE'
  if (['f', 'female', 'woman'].includes(value)) return 'FEMALE'
  if (['o', 'other', 'others', 'x'].includes(value)) return 'OTHER'
  return null
}

/** Whole years between two dates, counting a year only once its anniversary has passed. */
export function wholeYearsBetween(from: Date, to: Date) {
  let years = to.getUTCFullYear() - from.getUTCFullYear()
  const anniversaryPassed = to.getUTCMonth() > from.getUTCMonth() || (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() >= from.getUTCDate())
  if (!anniversaryPassed) years--
  return Math.max(0, years)
}

export function ageOn(dateOfBirth: Date, on = new Date()) {
  return wholeYearsBetween(dateOfBirth, on)
}

export function yearsOfService(startDate: Date, endDate?: Date | null, on = new Date()) {
  return wholeYearsBetween(startDate, endDate && endDate < on ? endDate : on)
}

export const MINIMUM_WORKING_AGE = 15
/** SSNIT pensionable age in Ghana. */
export const RETIREMENT_AGE = 60

export function retirementDate(dateOfBirth: Date) {
  return new Date(Date.UTC(dateOfBirth.getUTCFullYear() + RETIREMENT_AGE, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()))
}

/** True when someone is already of retirement age or reaches it within `months`. */
export function nearRetirement(dateOfBirth: Date, on = new Date(), months = 6) {
  const horizon = new Date(on)
  horizon.setUTCMonth(horizon.getUTCMonth() + months)
  return retirementDate(dateOfBirth) <= horizon
}

/** Validates a date of birth typed into a form. Returns an error message or null. */
export function checkDateOfBirth(raw: string, { required }: { required: boolean }, today = new Date()): string | null {
  if (!raw) return required ? 'Enter their date of birth.' : null
  const dob = new Date(raw)
  if (Number.isNaN(dob.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'Enter a valid date of birth.'
  if (dob > today) return 'Date of birth can’t be in the future.'
  const age = ageOn(dob, today)
  if (age < MINIMUM_WORKING_AGE) return `They must be at least ${MINIMUM_WORKING_AGE} years old.`
  if (age > 100) return 'Check the year of birth.'
  return null
}
