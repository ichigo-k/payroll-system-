import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { SELF_SERVICE_NAV_ITEMS } from '@/lib/nav-items'
import { BRAND, Logo } from '@/lib/brand'

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
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/70 backdrop-blur">
        <div className="flex h-12 items-center px-4">
          <div className="flex items-center gap-2.5 pr-4">
            <Logo size={26} />
            <div className="leading-tight">
              <p className="text-[13px] font-semibold">{BRAND.name}</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Self service</p>
            </div>
          </div>

          <div className="h-5 w-px bg-border" />

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {SELF_SERVICE_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 sm:flex">
              <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary/20 text-[10px] font-semibold text-primary">
                {initials}
              </div>
              <span className="text-[12px] font-medium">{fullName}</span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex border-t border-border sm:hidden">
          {SELF_SERVICE_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 border-r border-border px-3 py-2.5 text-center text-[12px] font-medium text-muted-foreground last:border-r-0 hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </main>

      <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-card/60 px-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Signed in</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <span className="font-mono">{fullName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="font-mono">{BRAND.name}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>v0.1</span>
        </div>
      </footer>
    </div>
  )
}
