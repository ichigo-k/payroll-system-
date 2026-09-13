/**
 * Banks licensed by the Bank of Ghana. There's no free public API for this list (Paystack's needs a
 * secret key and has no logos), and it changes rarely, so it lives here. Logos are loaded live from
 * each bank's website via a favicon service, with initials as the fallback.
 */

export type GhanaBank = { name: string; short: string; domain: string; aliases?: string[] }

export const GHANA_BANKS: GhanaBank[] = [
  { name: 'Absa Bank Ghana', short: 'Absa', domain: 'absa.com.gh', aliases: ['barclays'] },
  { name: 'Access Bank Ghana', short: 'Access', domain: 'ghana.accessbankplc.com' },
  { name: 'Agricultural Development Bank', short: 'ADB', domain: 'agricbank.com', aliases: ['adb', 'agric'] },
  { name: 'ARB Apex Bank', short: 'ARB Apex', domain: 'arbapexbank.com', aliases: ['rural bank', 'apex'] },
  { name: 'Bank of Africa Ghana', short: 'BOA', domain: 'boaghana.com', aliases: ['boa'] },
  { name: 'CalBank', short: 'CalBank', domain: 'calbank.net', aliases: ['cal bank'] },
  { name: 'Consolidated Bank Ghana', short: 'CBG', domain: 'cbg.com.gh', aliases: ['cbg'] },
  { name: 'Ecobank Ghana', short: 'Ecobank', domain: 'ecobank.com' },
  { name: 'FBNBank Ghana', short: 'FBN', domain: 'fbnbankghana.com', aliases: ['first bank of nigeria', 'fbn'] },
  { name: 'Fidelity Bank Ghana', short: 'Fidelity', domain: 'fidelitybank.com.gh' },
  { name: 'First Atlantic Bank', short: 'First Atlantic', domain: 'firstatlanticbank.com.gh' },
  { name: 'First National Bank Ghana', short: 'FNB', domain: 'firstnationalbank.com.gh', aliases: ['fnb'] },
  { name: 'GCB Bank', short: 'GCB', domain: 'gcbbank.com.gh', aliases: ['ghana commercial bank', 'gcb'] },
  { name: 'Guaranty Trust Bank Ghana', short: 'GTBank', domain: 'gtbghana.com', aliases: ['gtbank', 'gtb'] },
  { name: 'National Investment Bank', short: 'NIB', domain: 'nib-ghana.com', aliases: ['nib'] },
  { name: 'OmniBSIC Bank Ghana', short: 'OmniBSIC', domain: 'omnibsic.com.gh', aliases: ['omni', 'bsic'] },
  { name: 'Prudential Bank', short: 'Prudential', domain: 'prudentialbank.com.gh' },
  { name: 'Republic Bank Ghana', short: 'Republic', domain: 'republicghana.com', aliases: ['hfc'] },
  { name: 'Société Générale Ghana', short: 'SG', domain: 'societegenerale.com.gh', aliases: ['societe generale', 'sg ghana', 'sg-ssb'] },
  { name: 'Stanbic Bank Ghana', short: 'Stanbic', domain: 'stanbicbank.com.gh' },
  { name: 'Standard Chartered Bank Ghana', short: 'StanChart', domain: 'sc.com', aliases: ['standard chartered', 'stanchart', 'scb'] },
  { name: 'United Bank for Africa Ghana', short: 'UBA', domain: 'ubaghana.com', aliases: ['uba'] },
  { name: 'Universal Merchant Bank', short: 'UMB', domain: 'myumbbank.com', aliases: ['umb'] },
  { name: 'Zenith Bank Ghana', short: 'Zenith', domain: 'zenithbank.com.gh' },
]

const normalise = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(ghana|limited|ltd|plc|bank)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Finds the listed bank for a saved name, including older spellings like "Ghana Commercial Bank". */
export function findGhanaBank(name: string | null | undefined): GhanaBank | null {
  if (!name?.trim()) return null
  const target = normalise(name)
  if (!target) return null
  return GHANA_BANKS.find((bank) => normalise(bank.name) === target || normalise(bank.short) === target || bank.aliases?.some((alias) => normalise(alias) === target)) ?? null
}

/** Banks matching what's been typed: name, short name or alias. */
export function searchGhanaBanks(query: string): GhanaBank[] {
  const words = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (!words.length) return GHANA_BANKS
  // Every typed word has to start a word in the name, short name or an alias: "stan" finds Stanbic, not "First"
  const matches = (text: string) => {
    const targets = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/)
    return words.every((word) => targets.some((target) => target.startsWith(word)))
  }
  return GHANA_BANKS.filter((bank) => [bank.name, bank.short, ...(bank.aliases ?? [])].some(matches))
}

export function bankLogoUrl(bank: GhanaBank, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bank.domain)}&sz=${size}`
}

export function bankInitials(name: string) {
  const bank = findGhanaBank(name)
  const source = bank?.short ?? name
  const words = source.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join('') : source.slice(0, 3)).toUpperCase()
}
