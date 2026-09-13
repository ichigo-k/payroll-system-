/**
 * Countries for nationality, stored as ISO 3166-1 alpha-2 codes. Names come from the runtime's
 * Intl data, so there's no list of names to maintain. Flags load from flagcdn.com (Windows doesn't
 * draw flag emoji), with the country code as the fallback.
 */

const CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(
    ' ',
  )

/** Shown first when names tie, since most staff will be from Ghana and its neighbours. */
const PRIORITY = ['GH', 'NG', 'TG', 'CI', 'BF']

export type Country = { code: string; name: string }

let names: Intl.DisplayNames | null = null
function displayNames() {
  names ??= new Intl.DisplayNames(['en'], { type: 'region' })
  return names
}

export function countryName(code: string | null | undefined) {
  if (!code) return ''
  try {
    return displayNames().of(code.toUpperCase()) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

let cached: Country[] | null = null
export function allCountries(): Country[] {
  cached ??= CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name))
  return cached
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Demonyms people commonly type instead of the country name. */
const ALIASES: Record<string, string> = {
  ghanaian: 'GH',
  nigerian: 'NG',
  togolese: 'TG',
  ivorian: 'CI',
  burkinabe: 'BF',
  british: 'GB',
  uk: 'GB',
  england: 'GB',
  american: 'US',
  usa: 'US',
  chinese: 'CN',
  indian: 'IN',
  lebanese: 'LB',
  'south african': 'ZA',
  kenyan: 'KE',
  'ivory coast': 'CI',
}

/** Resolves a code ("GH"), name ("Ghana") or demonym ("Ghanaian") to a country code. */
export function findCountryCode(input: string | null | undefined): string | null {
  if (!input?.trim()) return null
  const value = fold(input)
  if (value.length === 2 && CODES.includes(value.toUpperCase())) return value.toUpperCase()
  if (ALIASES[value]) return ALIASES[value]
  return allCountries().find((c) => fold(c.name) === value)?.code ?? null
}

/** Countries whose name starts with, then contains, what's been typed. Ghana and neighbours win ties. */
export function searchCountries(query: string, limit = 6): Country[] {
  const q = fold(query)
  if (!q) return []
  const rank = (c: Country) => {
    const name = fold(c.name)
    const alias = Object.entries(ALIASES).some(([a, code]) => code === c.code && a.startsWith(q))
    const score = name.startsWith(q) || c.code.toLowerCase() === q || alias ? 0 : name.split(/[\s-]+/).some((w) => w.startsWith(q)) ? 1 : name.includes(q) ? 2 : 3
    const priority = PRIORITY.indexOf(c.code)
    return score * 10 + (priority === -1 ? 9 : priority)
  }
  return allCountries()
    .map((c) => ({ c, r: rank(c) }))
    .filter(({ r }) => r < 30)
    .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map(({ c }) => c)
}

export function flagUrl(code: string) {
  return `https://flagcdn.com/${code.toLowerCase()}.svg`
}
