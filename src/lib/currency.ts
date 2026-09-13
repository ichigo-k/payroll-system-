/**
 * The workspace currency. An administrator picks it in Settings and every amount on screen, in
 * documents and in exports shows it. It's a label only: amounts aren't converted, and PAYE and
 * SSNIT still follow the rules in the tax configuration.
 *
 * PayCompass runs one company per deployment, so the active currency is kept in module state:
 * loaded on the server whenever a signed-in user is resolved, and synced to the browser by the
 * portal layouts. Codes (GHS, USD) are shown instead of symbols so PDFs render every currency.
 */

export const CURRENCIES = [
  { code: 'GHS', name: 'Ghanaian cedi', symbol: 'GH₵', country: 'GH' },
  { code: 'USD', name: 'US dollar', symbol: '$', country: 'US' },
  { code: 'GBP', name: 'British pound', symbol: '£', country: 'GB' },
  { code: 'EUR', name: 'Euro', symbol: '€', country: 'EU' },
  { code: 'NGN', name: 'Nigerian naira', symbol: '₦', country: 'NG' },
  { code: 'XOF', name: 'West African CFA franc', symbol: 'CFA', country: 'SN' },
  { code: 'KES', name: 'Kenyan shilling', symbol: 'KSh', country: 'KE' },
  { code: 'ZAR', name: 'South African rand', symbol: 'R', country: 'ZA' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']
export const DEFAULT_CURRENCY: CurrencyCode = 'GHS'

let active: CurrencyCode = DEFAULT_CURRENCY

export function isCurrencyCode(code: unknown): code is CurrencyCode {
  return typeof code === 'string' && CURRENCIES.some((c) => c.code === code)
}

export function setActiveCurrency(code: string | null | undefined) {
  if (isCurrencyCode(code)) active = code
}

export function activeCurrency(): CurrencyCode {
  return active
}

export function currencyInfo(code: string = active) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]
}

/** "GHS 1,234.50" */
export function formatMoney(value: number, code: string = active) {
  return `${code} ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
