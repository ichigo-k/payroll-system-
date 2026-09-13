'use server'

import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/access'
import { type NotificationPayload, toPayload } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

export async function recentNotifications(): Promise<{ items: NotificationPayload[]; unread: number }> {
  const user = await currentUser()
  if (!user) return { items: [], unread: 0 }
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ])
  return { items: rows.map(toPayload), unread }
}

export async function markNotificationRead(id: string) {
  const user = await currentUser()
  if (!user) return
  await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } })
}

export async function markAllNotificationsRead() {
  const user = await currentUser()
  if (!user) return
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
  revalidatePath('/portal/financial/notifications')
  revalidatePath('/portal/self-service/notifications')
}

export async function setEmailNotifications(enabled: boolean) {
  const user = await currentUser()
  if (!user) return
  await prisma.user.update({ where: { id: user.id }, data: { notifyByEmail: enabled } })
  revalidatePath('/portal/financial/notifications')
  revalidatePath('/portal/self-service/notifications')
}
