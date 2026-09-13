'use client'

import { setActiveCurrency } from '@/lib/currency'

/**
 * Makes the workspace currency available to client components. Rendered by the portal layouts before
 * the page, and set during render (not in an effect) so the first paint already uses it.
 */
export function CurrencySync({ code }: { code: string }) {
  setActiveCurrency(code)
  return null
}
