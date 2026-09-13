import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NotificationsView } from '@/components/app/notifications-view'
import { currentUser } from '@/lib/access'
import { markChecklistVisit } from '@/lib/checklists'

export const metadata: Metadata = { title: 'Notifications' }

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser()
  if (!user) redirect('/login')
  await markChecklistVisit(user, ['approver.notifications'])
  return <NotificationsView userId={user.id} basePath="/portal/financial/notifications" raw={await searchParams} />
}
