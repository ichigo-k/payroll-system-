'use client'

import Link from 'next/link'
import { Menu } from '@base-ui/react/menu'
import { ChevronDown, ClipboardList, Percent, Plus, Upload, UserPlus } from 'lucide-react'
import { button } from './styles'

const ITEMS = [
  { label: 'Employee', description: 'Add one person to payroll', href: '/portal/financial/employees?panel=new', icon: UserPlus, roles: ['ADMIN', 'PREPARER'] },
  { label: 'Import employees', description: 'Upload a CSV of your staff', href: '/portal/financial/employees?panel=import', icon: Upload, roles: ['ADMIN', 'PREPARER'] },
  { label: 'Payroll run', description: 'Prepare this month’s pay', href: '/portal/financial/payroll', icon: ClipboardList, roles: ['ADMIN', 'PREPARER'] },
  { label: 'Tax configuration', description: 'PAYE brackets and SSNIT rates', href: '/portal/financial/tax?new=1', icon: Percent, roles: ['ADMIN'] },
]

export function CreateMenu({ role }: { role: string }) {
  const items = ITEMS.filter((item) => item.roles.includes(role))
  if (items.length === 0) return null

  return (
    <Menu.Root>
      <Menu.Trigger className={button.primary}>
        <Plus className="size-4" />
        <span className="hidden sm:inline">Create</span>
        <ChevronDown className="hidden size-3.5 opacity-80 sm:block" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Menu.Popup className="w-72 origin-(--transform-origin) rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
            <p className="px-2 pt-1.5 pb-1 text-xs font-semibold text-subtlest">Create</p>
            {items.map(({ label, description, href, icon: Icon }) => (
              <Menu.LinkItem
                key={href}
                closeOnClick
                render={<Link href={href} />}
                className="flex items-start gap-2.5 rounded-md px-2 py-2 text-sm text-foreground outline-none data-highlighted:bg-secondary"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
