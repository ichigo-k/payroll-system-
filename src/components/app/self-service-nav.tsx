'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/nav-items'

const HOME: NavItem = { label: 'Home', href: '/portal/self-service' }

export function SelfServiceNav({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Self service" className={cn('flex gap-1 overflow-x-auto', className)}>
      {[HOME, ...items].map((item) => {
        const active = item.href === HOME.href ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-full min-h-11 items-center border-b-2 px-2 text-sm font-medium whitespace-nowrap transition-colors duration-150',
              active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
