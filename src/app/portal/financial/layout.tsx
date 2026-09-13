import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Search } from 'lucide-react'
import { auth, signOut } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { getFinancialNavItems } from '@/lib/nav-items'
import { BRAND, Logo, LogoMark } from '@/lib/brand'
import { FinancialNav } from '@/components/app/financial-nav'
import { CreateMenu } from '@/components/app/create-menu'
import { button } from '@/components/app/styles'
import { Sidebar, SidebarContent, SidebarFooter, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  PREPARER: 'Payroll preparer',
  APPROVER: 'Payroll approver',
}

export default async function FinancialLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect('/login')

  const { firstName, lastName, role } = session.user
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User'
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U'
  const navItems = getFinancialNavItems(role)
  const roleLabel = ROLE_LABELS[role] ?? role
  const period = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <SidebarProvider className="min-h-dvh flex-col">
      {/* Slim global top bar spanning the whole app */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:px-3">
        <SidebarTrigger className="size-8 text-muted-foreground hover:bg-secondary hover:text-foreground" />
        <Link href="/portal/financial" className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
          <LogoMark size={26} className="sm:hidden" title={BRAND.name} />
          <Logo size={26} className="hidden sm:inline-flex" />
        </Link>

        <form action="/portal/financial/employees" aria-label="Search employees" className="mx-auto hidden w-full max-w-xl px-4 md:block">
          <label className="relative block">
            <span className="sr-only">Search employees</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtlest" />
            <input
              name="q"
              type="search"
              placeholder="Search employees"
              className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-8 text-sm text-foreground transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-subtlest hover:bg-muted focus:border-ring focus:bg-card focus:shadow-[inset_0_0_0_1px_var(--ring)] focus:outline-none"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <CreateMenu role={role} />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <div className="hidden text-right leading-tight lg:block">
            <p className="text-sm font-medium text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <span
            aria-hidden
            title={fullName}
            className="flex size-8 items-center justify-center rounded-full bg-brand-deep text-xs font-semibold text-white"
          >
            {initials}
          </span>
          <form action={logoutAction}>
            <button type="submit" aria-label="Sign out" title="Sign out" className={button.icon}>
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <Sidebar className="top-14 h-[calc(100svh-3.5rem)] border-r border-sidebar-border">
          <SidebarContent>
            <FinancialNav items={navItems} />
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
            <p className="text-xs text-subtlest">Current pay period</p>
            <p className="num text-sm font-medium text-foreground">{period}</p>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0 bg-background">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 lg:px-10">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
