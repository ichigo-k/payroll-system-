import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { getFinancialNavItems } from '@/lib/nav-items'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

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

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  ADMIN: 'default',
  PREPARER: 'secondary',
  APPROVER: 'outline',
}

// Nav icons
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  '/portal/financial/users': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  '/portal/financial/config': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  '/portal/financial/audit': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
}

export default async function FinancialLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect('/login')

  const { firstName, lastName, role } = session.user
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User'
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U'
  const navItems = getFinancialNavItems(role)
  const roleLabel = ROLE_LABELS[role] ?? role
  const badgeVariant = ROLE_BADGE_VARIANT[role] ?? 'outline'

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-[#050505]">

        {/* ── Sidebar ── */}
        <Sidebar className="border-r border-slate-200/50 bg-white/50 backdrop-blur-xl dark:border-white/5 dark:bg-[#0a0f1a]/80">
          <SidebarHeader className="border-b border-slate-200/50 px-5 py-5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066FF] to-indigo-600 shadow-md shadow-indigo-500/20">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">Ghana Payroll</p>
                <p className="text-[11px] font-medium text-gray-500 dark:text-white/40">Financial Portal</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3 py-4">
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30">
                Navigation
              </SidebarGroupLabel>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      className="gap-3 text-gray-500 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-600 data-[active=true]:bg-indigo-500/10 data-[active=true]:text-indigo-600 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white dark:data-[active=true]:bg-indigo-500/20 dark:data-[active=true]:text-indigo-400"
                    >
                      {NAV_ICONS[item.href] ?? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      )}
                      <span className="font-medium">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200/50 p-4 dark:border-white/5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar className="h-9 w-9 rounded-xl border border-indigo-100 shadow-sm dark:border-white/10">
                <AvatarFallback className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-xs font-bold text-indigo-600 dark:from-indigo-500/20 dark:to-indigo-500/10 dark:text-indigo-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{fullName}</p>
                <Badge variant={badgeVariant} className="mt-0.5 h-4 border-gray-200 bg-gray-100 px-1.5 text-[10px] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  {roleLabel}
                </Badge>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-white/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </form>
          </SidebarFooter>
        </Sidebar>

        {/* ── Main ── */}
        <SidebarInset className="relative flex flex-1 flex-col bg-transparent">
          {/* subtle mesh background */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute -right-1/2 -top-1/2 h-full w-full rounded-full bg-gradient-to-b from-indigo-500/10 to-transparent opacity-50 blur-3xl dark:from-indigo-500/5" />
            <div className="absolute -left-1/4 top-0 h-3/4 w-3/4 rounded-full bg-gradient-to-b from-purple-500/10 to-transparent opacity-50 blur-3xl dark:from-purple-500/5" />
          </div>

          {/* Top bar */}
          <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200/50 bg-white/70 px-6 backdrop-blur-md transition-all dark:border-white/5 dark:bg-black/50">
            <SidebarTrigger className="text-gray-400 transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/80" />
            <Separator orientation="vertical" className="h-6 bg-gray-200 dark:bg-white/10" />
            <p className="text-sm font-bold text-gray-900 dark:text-white">Financial Portal</p>
            <div className="ml-auto flex items-center gap-3 text-sm text-gray-500 dark:text-white/50">
              <span className="hidden font-medium sm:inline">Signed in as</span>
              <div className="flex items-center gap-2 rounded-full bg-gray-100/80 py-1 pl-2 pr-3 shadow-inner dark:bg-white/5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {initials}
                </div>
                <span className="font-bold text-gray-800 dark:text-white/90">{fullName}</span>
              </div>
            </div>
          </header>

          <main className="relative z-10 flex-1 overflow-auto p-8">
            {children}
          </main>
        </SidebarInset>

      </div>
    </SidebarProvider>
  )
}
