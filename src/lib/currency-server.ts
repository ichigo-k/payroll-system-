import { activeCurrency, setActiveCurrency } from '@/lib/currency'
import { prisma } from '@/lib/prisma'

const TTL_MS = 30_000
let loadedAt = 0

/** Reads the workspace currency from settings (cached briefly) and makes it the active one. */
export async function loadActiveCurrency() {
  if (Date.now() - loadedAt > TTL_MS) {
    try {
      const config = await prisma.systemConfig.findFirst({ where: { isActive: true }, select: { currency: true } })
      setActiveCurrency(config?.currency)
      loadedAt = Date.now()
    } catch (err) {
      console.error('[currency] could not load the workspace currency:', err)
    }
  }
  return activeCurrency()
}

/** Call after the currency changes so this server instance picks it up straight away. */
export function refreshActiveCurrency(code: string) {
  setActiveCurrency(code)
  loadedAt = Date.now()
}
