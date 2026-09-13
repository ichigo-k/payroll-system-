import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PAGE_SIZES, pageWindow } from '@/lib/pagination'
import { cn } from '@/lib/utils'

/**
 * Server-rendered pagination footer. `hrefFor` builds the URL for a page and size,
 * so filters and search stay in the query string.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  noun = 'items',
}: {
  page: number
  pageSize: number
  total: number
  hrefFor: (page: number, size: number) => string
  noun?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)
  const itemClass = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition-colors duration-150'

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="num text-sm text-muted-foreground">
        {total === 0 ? `No ${noun}` : `Showing ${from}-${to} of ${total.toLocaleString('en-GB')} ${noun}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Rows</span>
          {PAGE_SIZES.map((size) => (
            <Link
              key={size}
              href={hrefFor(1, size)}
              aria-current={size === pageSize ? 'true' : undefined}
              className={cn(itemClass, 'num min-w-0 px-1.5', size === pageSize ? 'font-semibold text-foreground' : 'hover:bg-secondary hover:text-foreground')}
            >
              {size}
            </Link>
          ))}
        </div>

        {pages > 1 && (
          <div className="flex items-center gap-0.5">
            {current > 1 ? (
              <Link href={hrefFor(current - 1, pageSize)} aria-label="Previous page" className={cn(itemClass, 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span aria-hidden className={cn(itemClass, 'text-subtlest/50')}>
                <ChevronLeft className="size-4" />
              </span>
            )}
            {pageWindow(current, pages).map((p, index) =>
              p === null ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity
                <span key={`gap-${index}`} className={cn(itemClass, 'text-subtlest')}>
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={hrefFor(p, pageSize)}
                  aria-current={p === current ? 'page' : undefined}
                  className={cn(itemClass, 'num', p === current ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
                >
                  {p}
                </Link>
              ),
            )}
            {current < pages ? (
              <Link href={hrefFor(current + 1, pageSize)} aria-label="Next page" className={cn(itemClass, 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span aria-hidden className={cn(itemClass, 'text-subtlest/50')}>
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
