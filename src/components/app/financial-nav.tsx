'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  House,
  Receipt,
  Percent,
  ScanEye,
  ScrollText,
  Settings,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import type { NavItem } from '@/lib/nav-items'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const NAV_ICONS: Record<string, LucideIcon> = {
  '/portal/financial': House,
  '/portal/financial/employees': Users,
  '/portal/financial/salary': Wallet,
  '/portal/financial/tax': Percent,
  '/portal/financial/payroll': ClipboardList,
  '/portal/financial/reports': ChartColumn,
  '/portal/financial/approvals': ClipboardCheck,
  '/portal/financial/review': ScanEye,
  '/portal/financial/users': UserCog,
  '/portal/financial/config': Settings,
  '/portal/financial/audit': ScrollText,
  '/portal/self-service': Receipt,
}

const NAV_SECTIONS: { label: string; hrefs: string[] }[] = [
  { label: 'Payroll', hrefs: ['/portal/financial/payroll', '/portal/financial/approvals', '/portal/financial/review'] },
  { label: 'People', hrefs: ['/portal/financial/employees', '/portal/financial/salary'] },
  { label: 'Configuration', hrefs: ['/portal/financial/tax', '/portal/financial/users', '/portal/financial/config'] },
  { label: 'Insights', hrefs: ['/portal/financial/reports', '/portal/financial/audit'] },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/portal/financial') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = NAV_ICONS[item.href]
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        render={<Link href={item.href} aria-current={active ? 'page' : undefined} />}
        className={cn(
          'relative h-8 gap-2.5 rounded-lg px-2 text-sm text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          'data-active:bg-accent data-active:font-medium data-active:text-primary data-active:hover:bg-accent',
          'data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-primary',
        )}
      >
        {Icon && <Icon className="size-4" strokeWidth={1.75} />}
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(true)
  const id = `nav-${label.toLowerCase()}`
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-7 w-full items-center gap-1 rounded-lg px-2 text-xs font-semibold text-subtlest outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn('size-3.5 transition-transform duration-200 ease-out', !open && '-rotate-90')} />
      </button>
      {open && (
        <SidebarMenu id={id} className="mt-0.5 gap-0.5">
          {items.map((item) => (
            <NavButton key={item.href} item={item} active={isActivePath(pathname, item.href)} />
          ))}
        </SidebarMenu>
      )}
    </div>
  )
}

export function FinancialNav({ items, hasSelfService = false }: { items: NavItem[]; hasSelfService?: boolean }) {
  const pathname = usePathname()
  const byHref = new Map(items.map((item) => [item.href, item]))

  return (
    <nav aria-label="Workspace" className="px-2 py-3">
      <SidebarMenu className="gap-0.5">
        <NavButton item={{ label: 'Home', href: '/portal/financial' }} active={isActivePath(pathname, '/portal/financial')} />
      </SidebarMenu>
      {NAV_SECTIONS.map((section) => {
        const sectionItems = section.hrefs.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item))
        if (sectionItems.length === 0) return null
        return <NavGroup key={section.label} label={section.label} items={sectionItems} pathname={pathname} />
      })}
      {hasSelfService && (
        <div className="mt-4 border-t border-sidebar-border pt-3">
          <p className="px-2 pb-1 text-xs font-semibold text-subtlest">Personal</p>
          <SidebarMenu className="gap-0.5">
            <NavButton item={{ label: 'My pay (self-service)', href: '/portal/self-service' }} active={false} />
          </SidebarMenu>
        </div>
      )}
    </nav>
  )
}
