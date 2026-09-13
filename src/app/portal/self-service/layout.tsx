import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, LogOut } from 'lucide-react'
import { auth, signOut } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { SELF_SERVICE_NAV_ITEMS } from '@/lib/nav-items'
import { Logo } from '@/lib/brand'
import { isFinancialRole } from '@/lib/roles'
import { SelfServiceNav } from '@/components/app/self-service-nav'
import { button } from '@/components/app/styles'
import { FlagProvider } from '@/components/app/flags'
import { NotificationBell } from '@/components/app/notification-bell'
import { CurrencySync } from '@/components/app/currency-sync'
import { loadActiveCurrency } from '@/lib/currency-server'

async function logoutAction() {
  'use server'
  const session = await auth()
  if (session?.user?.id) {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: session.user.id,
      },
    })
  }
  await signOut({ redirectTo: '/login' })
}

export default async function SelfServiceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { firstName, lastName } = session.user
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Employee'
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'E'
  const unread = await prisma.notification.count({ where: { userId: session.user.id, readAt: null } })

  const currency = await loadActiveCurrency()

  return (
    <FlagProvider>
      <CurrencySync code={currency} />
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card print:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/portal/self-service" className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
            <Logo size={26} />
          </Link>
          <SelfServiceNav items={SELF_SERVICE_NAV_ITEMS} className="hidden h-14 md:flex" />
          <div className="ml-auto flex items-center gap-2">
            {isFinancialRole(session.user.role) && (
              <Link href="/portal/financial" className={`${button.subtle} hidden sm:inline-flex`}>
                <LayoutGrid className="size-4" />
                Payroll workspace
              </Link>
            )}
            <NotificationBell initialUnread={unread} notificationsHref="/portal/self-service/notifications" />
            <span className="hidden text-sm font-medium sm:inline">{fullName}</span>
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand-deep text-xs font-semibold text-white">
              {initials}
            </span>
            <form action={logoutAction}>
              <button type="submit" aria-label="Sign out" title="Sign out" className={button.icon}>
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
        <SelfServiceNav items={SELF_SERVICE_NAV_ITEMS} className="border-t border-border px-2 md:hidden" />
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">{children}</div>
      </main>
    </div>
    </FlagProvider>
  )
}
