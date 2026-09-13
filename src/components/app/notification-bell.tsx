'use client'

import { Popover } from '@base-ui/react/popover'
import { Bell, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { markAllNotificationsRead, markNotificationRead, recentNotifications } from '@/app/portal/notification-actions'
import type { NotificationPayload } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { useFlags } from './flags'
import { button } from './styles'

export function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Bell with unread count. Subscribes to the live stream so new notifications pop up instantly
 * as a flag, and refreshes the current page so lists and statuses stay current.
 */
export function NotificationBell({ initialUnread, notificationsHref }: { initialUnread: number; notificationsHref: string }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [unread, setUnread] = useState(initialUnread)
  const [items, setItems] = useState<NotificationPayload[] | null>(null)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      const result = await recentNotifications()
      setItems(result.items)
      setUnread(result.unread)
    })
  }, [])

  useEffect(() => {
    const source = new EventSource('/api/notifications/stream')
    source.addEventListener('notification', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as NotificationPayload
      setUnread((count) => count + 1)
      setItems((current) => (current ? [payload, ...current].slice(0, 8) : current))
      showFlag({ tone: 'info', title: payload.title, description: payload.body ?? undefined, href: payload.href ?? undefined })
      router.refresh()
    })
    return () => source.close()
  }, [router, showFlag])

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) load()
      }}
    >
      <Popover.Trigger aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={cn(button.icon, 'relative data-popup-open:bg-secondary')}>
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="num absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Popover.Popup className="w-[min(380px,calc(100vw-2rem))] origin-(--transform-origin) rounded-lg border border-border bg-popover shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await markAllNotificationsRead()
                      setUnread(0)
                      setItems((current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null)
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {items === null ? (
                <div className="space-y-3 p-4" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">You’re all caught up.</p>
              ) : (
                <ul>
                  {items.map((item) => (
                    <li key={item.id} className="border-b border-border last:border-b-0">
                      <Link
                        href={item.href ?? notificationsHref}
                        onClick={() => {
                          setOpen(false)
                          if (!item.readAt) {
                            setUnread((count) => Math.max(0, count - 1))
                            startTransition(() => markNotificationRead(item.id))
                          }
                        }}
                        className="flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted"
                      >
                        <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-primary')} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-sm', item.readAt ? 'text-muted-foreground' : 'font-medium text-foreground')}>{item.title}</span>
                          {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>}
                          <span className="mt-1 block text-xs text-subtlest">{timeAgo(item.createdAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-border px-4 py-2.5 text-center">
              <Link href={notificationsHref} onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">
                View all notifications
              </Link>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
