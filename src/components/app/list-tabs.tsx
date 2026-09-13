import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Underline tabs for list views, with counts. Scrolls sideways on narrow screens without a scrollbar. */
export function ListTabs({ label, tabs }: { label: string; tabs: { key: string; label: string; href: string; count?: number; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-2px_0_var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2 text-sm font-medium whitespace-nowrap transition-colors duration-150',
            tab.active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('num rounded-full px-1.5 text-xs', tab.active ? 'bg-accent text-primary' : 'bg-secondary text-muted-foreground')}>{tab.count}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}

/** Builds hrefs that keep existing query params and reset the page when filters change. */
export function queryHref(base: string, current: Record<string, string | undefined>, patch: Record<string, string | number | undefined>) {
  const next: Record<string, string | undefined> = { ...current }
  for (const [key, value] of Object.entries(patch)) next[key] = value === undefined || value === '' ? undefined : String(value)
  if (!('page' in patch)) next.page = undefined
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) if (value) search.set(key, value)
  const qs = search.toString()
  return `${base}${qs ? `?${qs}` : ''}`
}
