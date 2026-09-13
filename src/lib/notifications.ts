import { EventEmitter } from 'node:events'
import type { Role } from '@prisma/client'
import { sendNotificationEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

export type NotificationPayload = {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  createdAt: string
  readAt: string | null
}

// In-process fan-out to open live streams. Kept on globalThis so dev hot reloads share one bus.
const globalBus = globalThis as unknown as { __paycompassNotifications?: EventEmitter }
export const notificationBus = globalBus.__paycompassNotifications ?? new EventEmitter().setMaxListeners(0)
globalBus.__paycompassNotifications = notificationBus

export function channelFor(userId: string) {
  return `user:${userId}`
}

export function toPayload(n: { id: string; type: string; title: string; body: string | null; href: string | null; createdAt: Date; readAt: Date | null }): NotificationPayload {
  return { id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null }
}

/** Active users holding any of the roles, optionally excluding people (usually whoever triggered the event). */
export async function userIdsWithRoles(roles: Role[], exclude: string[] = []) {
  const users = await prisma.user.findMany({ where: { role: { in: roles }, status: 'active', id: { notIn: exclude } }, select: { id: true } })
  return users.map((u) => u.id)
}

/**
 * Sends an in-app notification (live if they're signed in) and, unless they've turned it off, an email.
 * Emails never include pay amounts; they link back to the app.
 */
export async function notify(
  userIds: string[],
  notification: { type: string; title: string; body?: string; href?: string },
  email?: { subject: string; heading: string; actionLabel?: string; details?: [string, string][] },
) {
  const recipients = [...new Set(userIds)]
  if (recipients.length === 0) return

  const created = await prisma.notification.createManyAndReturn({
    data: recipients.map((userId) => ({ userId, type: notification.type, title: notification.title, body: notification.body ?? null, href: notification.href ?? null })),
  })
  for (const row of created) notificationBus.emit(channelFor(row.userId), toPayload(row))

  if (!email) return
  const users = await prisma.user.findMany({
    where: { id: { in: recipients }, status: 'active', notifyByEmail: true },
    select: { email: true, firstName: true },
  })
  await Promise.all(
    users.map((user) =>
      sendNotificationEmail({
        to: user.email,
        firstName: user.firstName,
        subject: email.subject,
        heading: email.heading,
        body: notification.body ?? notification.title,
        href: notification.href,
        actionLabel: email.actionLabel,
        details: email.details,
      }).catch((err) => console.error('[notify] email failed:', err)),
    ),
  )
}
