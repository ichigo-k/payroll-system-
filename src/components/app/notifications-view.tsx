import Link from 'next/link'
import { parsePage } from '@/lib/pagination'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { ListTabs, queryHref } from './list-tabs'
import { EmailToggle, MarkAllReadButton } from './notification-controls'
import { PageHeader } from './page-header'
import { Pagination } from './pagination'

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Full notification history, shared by both portals. */
export async function NotificationsView({ userId, basePath, raw }: { userId: string; basePath: string; raw: Record<string, string | string[] | undefined> }) {
  const unreadOnly = raw.view === 'unread'
  const { page, pageSize, skip, take } = parsePage(raw)
  const where = { userId, ...(unreadOnly ? { readAt: null } : {}) }

  const [items, total, unread, all, user] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.count({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { notifyByEmail: true } }),
  ])
  const current = { view: unreadOnly ? 'unread' : undefined, size: typeof raw.size === 'string' ? raw.size : undefined }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description="Updates about payroll runs, approvals, comments and your pay." actions={<MarkAllReadButton disabled={unread === 0} />} />

      <div className="mb-6 rounded-lg border border-border p-4">
        <EmailToggle enabled={user?.notifyByEmail ?? true} />
      </div>

      <ListTabs
        label="Notification views"
        tabs={[
          { key: 'all', label: 'All', count: all, active: !unreadOnly, href: queryHref(basePath, current, { view: undefined }) },
          { key: 'unread', label: 'Unread', count: unread, active: unreadOnly, href: queryHref(basePath, current, { view: 'unread' }) },
        ]}
      />

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const body = (
                <>
                  <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', n.readAt ? 'text-foreground' : 'font-semibold text-foreground')}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-xs text-subtlest">{dateTime(n.createdAt)}</span>
                  </span>
                </>
              )
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className="-mx-2 flex gap-3 rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-muted">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 py-3">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
          <Pagination page={page} pageSize={pageSize} total={total} noun="notifications" hrefFor={(p, size) => queryHref(basePath, current, { page: p, size })} />
        </>
      )}
    </div>
  )
}
