import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { getFinancialNavItems } from '@/lib/nav-items'
import { BRAND, Logo } from '@/lib/brand'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

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
  PREPARER: 'Payroll Preparer',
  APPROVER: 'Payroll Approver',
}

const NAV_ICONS: Record<string, React.ReactNode> = {
  '/portal/financial/employees': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  '/portal/financial/salary': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  '/portal/financial/tax': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  '/portal/financial/payroll': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  '/portal/financial/reports': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  '/portal/financial/approvals': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  '/portal/financial/review': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  '/portal/financial/users': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  '/portal/financial/config': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  '/portal/financial/audit': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
}

const NAV_SECTIONS: { label: string; hrefs: string[] }[] = [
  {
    label: 'Payroll',
    hrefs: ['/portal/financial/payroll', '/portal/financial/approvals', '/portal/financial/review'],
  },
  {
    label: 'People',
    hrefs: ['/portal/financial/employees', '/portal/financial/salary'],
  },
  {
    label: 'Configuration',
    hrefs: ['/portal/financial/tax', '/portal/financial/users', '/portal/financial/config'],
  },
  {
    label: 'Insights',
    hrefs: ['/portal/financial/reports', '/portal/financial/audit'],
  },
]

function currentPeriodLabel() {
  const now = new Date()
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export default async function FinancialLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect('/login')

  const { firstName, lastName, role } = session.user
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User'
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U'
  const navItems = getFinancialNavItems(role)
  const roleLabel = ROLE_LABELS[role] ?? role
  const navByHref = new Map(navItems.map((i) => [i.href, i]))
  const period = currentPeriodLabel()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Logo size={28} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">{BRAND.name}</p>
                <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/50">Workspace</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3">
            {NAV_SECTIONS.map((section) => {
              const items = section.hrefs.map((h) => navByHref.get(h)).filter(Boolean) as { label: string; href: string }[]
              if (items.length === 0) return null
              return (
                <SidebarGroup key={section.label} className="px-0">
                  <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
                    {section.label}
                  </SidebarGroupLabel>
                  <SidebarMenu>
                    {items.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          className="h-8 gap-2.5 rounded-md px-2 text-[13px] text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary"
                        >
                          <span className="text-sidebar-foreground/55">{NAV_ICONS[item.href]}</span>
                          <span className="font-medium">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              )
            })}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-3">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent text-[11px] font-semibold text-primary">
                {initials}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[12px] font-medium text-sidebar-accent-foreground">{fullName}</p>
                <p className="truncate text-[10px] text-sidebar-foreground/50">{roleLabel}</p>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-destructive"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </form>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="relative flex flex-1 flex-col bg-background">
          {/* Top toolbar — Compass style */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-3 border-b border-border bg-card/60 px-3 backdrop-blur">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-foreground">Financial</span>
              <span className="text-muted-foreground/60">/</span>
              <span className="text-muted-foreground">Overview</span>
            </div>

            {/* Period pill — analog of the cluster indicator */}
            <div className="ml-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
              <span className="text-muted-foreground uppercase tracking-wider">Period</span>
              <span className="font-mono text-foreground">{period}</span>
            </div>

            {/* Command palette placeholder */}
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search</span>
                <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
              </div>
            </div>
          </header>

          <main className="relative z-10 flex-1 overflow-auto">
            <div className="mx-auto max-w-[1400px] p-6">{children}</div>
          </main>

          {/* Status bar — Compass style */}
          <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-card/60 px-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Connected</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <span className="font-mono">{roleLabel}</span>
            <div className="h-3 w-px bg-border" />
            <span className="font-mono">{fullName}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="font-mono">{BRAND.name}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>v0.1</span>
            </div>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
