import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/access'
import { NotificationsView } from '@/components/app/notifications-view'

export const metadata: Metadata = { title: 'Notifications' }

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser()
  if (!user) redirect('/login')
  return <NotificationsView userId={user.id} basePath="/portal/self-service/notifications" raw={await searchParams} />
}
