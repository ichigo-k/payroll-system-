import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { SELF_SERVICE_NAV_ITEMS } from '@/lib/nav-items'
import { Button } from '@/components/ui/button'

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

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="flex items-center justify-between px-8 py-0">

          {/* Brand + nav */}
          <div className="flex items-center">
            <div className="flex items-center gap-3 border-r border-border py-4 pr-6">
              <div className="flex h-7 w-7 items-center justify-center border border-border bg-primary">
                <svg className="h-3.5 w-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Ghana Payroll</span>
            </div>

            <nav className="hidden items-center sm:flex">
              {SELF_SERVICE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border-r border-border px-5 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* User */}
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center border border-border bg-primary/10 text-xs font-bold text-primary">
                {initials}
              </div>
              <span className="text-sm font-medium">{fullName}</span>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-none text-xs"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </Button>
            </form>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex border-t border-border sm:hidden">
          {SELF_SERVICE_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 border-r border-border px-4 py-3 text-center text-sm text-muted-foreground last:border-r-0 hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="flex-1 bg-background">
        <div className="mx-auto max-w-4xl px-8 py-8">
          {children}
        </div>
      </main>

    </div>
  )
}
