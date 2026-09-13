import Link from 'next/link'
import { Fragment } from 'react'

export type Crumb = { label: string; href?: string }

/**
 * Atlassian-style page header: breadcrumbs, title and actions sit directly on the canvas, no card.
 */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
  children,
}: {
  breadcrumbs?: Crumb[]
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="pb-5">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.label}>
                {index > 0 && (
                  <li aria-hidden className="px-0.5 text-subtlest">
                    /
                  </li>
                )}
                <li>
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-foreground hover:underline underline-offset-2">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <div className="mt-1.5 max-w-[70ch] text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
