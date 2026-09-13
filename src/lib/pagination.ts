export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25

export type PageParams = { page: number; pageSize: number; skip: number; take: number }

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/** Reads `page` and `size` from search params with safe bounds. */
export function parsePage(raw: Record<string, string | string[] | undefined>, defaultSize: number = DEFAULT_PAGE_SIZE): PageParams {
  const page = Math.max(1, Number.parseInt(first(raw.page) ?? '1', 10) || 1)
  const requested = Number.parseInt(first(raw.size) ?? '', 10)
  const pageSize = (PAGE_SIZES as readonly number[]).includes(requested) ? requested : defaultSize
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

/** Page numbers to show, with gaps as null: 1 … 4 5 6 … 20 */
export function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...pages].sort((a, b) => a - b)
  const result: (number | null)[] = []
  for (const [index, page] of sorted.entries()) {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null)
    result.push(page)
  }
  return result
}
