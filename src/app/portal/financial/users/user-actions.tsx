'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { Ellipsis, Search } from 'lucide-react'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import type { ActionResult } from '@/lib/access'
import { ROLE_INFO, type RoleName } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { changeRoleAction, linkEmployeeAction, resendInviteAction, setStatusAction, unlinkEmployeeAction } from './actions'
import type { UnlinkedEmployee } from './invite-user-form'
import { RolePicker } from './role-picker'
import { safeAction } from '@/lib/safe-action'

export type UserRowData = {
  id: string
  name: string
  email: string
  role: RoleName
  status: string
  invited: boolean
  employee: { id: string; name: string } | null
}

type DialogKind = 'role' | 'link' | 'unlink' | 'deactivate' | 'reactivate' | null

const itemClass =
  'flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm text-foreground outline-none data-disabled:text-subtlest data-highlighted:bg-secondary'

export function UserActions({ user, isSelf, employees }: { user: UserRowData; isSelf: boolean; employees: UnlinkedEmployee[] }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [pending, startTransition] = useTransition()
  const [role, setRole] = useState<RoleName>(user.role)
  const [employeeId, setEmployeeId] = useState('')
  const [query, setQuery] = useState('')

  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await safeAction(action)
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        setDialog(null)
        after?.()
        router.refresh()
      }
    })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? employees.filter((e) => `${e.name} ${e.employeeId} ${e.email}`.toLowerCase().includes(q)) : employees
  }, [employees, query])

  const active = user.status === 'active'
  const openRole = () => {
    setRole(user.role)
    setDialog('role')
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger aria-label={`Actions for ${user.name}`} className={cn(button.icon, 'data-popup-open:bg-secondary')}>
          <Ellipsis className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="end" className="z-40 outline-none">
            <Menu.Popup className="w-56 origin-(--transform-origin) rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
              {isSelf && <p className="px-2 py-1.5 text-xs text-subtlest">This is your account. Another administrator must change your role or status.</p>}
              <Menu.Item disabled={isSelf || !active} onClick={openRole} className={itemClass}>
                Change role
              </Menu.Item>
              {user.employee ? (
                <Menu.Item disabled={user.role === 'EMPLOYEE'} onClick={() => setDialog('unlink')} className={itemClass}>
                  Unlink employee record
                </Menu.Item>
              ) : (
                <Menu.Item
                  onClick={() => {
                    setEmployeeId('')
                    setQuery('')
                    setDialog('link')
                  }}
                  className={itemClass}
                >
                  Link employee record
                </Menu.Item>
              )}
              {active && user.invited && (
                <Menu.Item onClick={() => run(() => resendInviteAction(user.id))} className={itemClass}>
                  Resend invite
                </Menu.Item>
              )}
              <Menu.Separator className="my-1 h-px bg-border" />
              {active ? (
                <Menu.Item disabled={isSelf} onClick={() => setDialog('deactivate')} className={cn(itemClass, 'text-danger data-highlighted:bg-danger-soft')}>
                  Deactivate
                </Menu.Item>
              ) : (
                <Menu.Item onClick={() => setDialog('reactivate')} className={itemClass}>
                  Reactivate
                </Menu.Item>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog
        open={dialog === 'role'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Change role for ${user.name}`}
        description="They’ll get an email about the change. New access applies within a minute, without signing out."
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending || role === user.role} onClick={() => run(() => changeRoleAction(user.id, role))} className={button.primary}>
              {pending ? 'Saving' : 'Change role'}
            </button>
          </>
        }
      >
        <div className="mt-4">
          <RolePicker
            name={`role-${user.id}`}
            value={role}
            onChange={setRole}
            disabledRoles={user.employee ? [] : ['EMPLOYEE']}
            hint={(r) => (r === 'EMPLOYEE' && !user.employee ? 'Link an employee record first.' : r === user.role ? 'Current role' : undefined)}
          />
          {user.employee && role !== 'EMPLOYEE' && (
            <p className="mt-3 text-sm text-muted-foreground">
              {user.name} stays linked to their employee record, so they can still open their own payslips.
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={dialog === 'link'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Link employee record"
        description={`Connect ${user.name} to the person they are on payroll, so they can see their own payslips.`}
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending || !employeeId} onClick={() => run(() => linkEmployeeAction(user.id, employeeId))} className={button.primary}>
              {pending ? 'Linking' : 'Link record'}
            </button>
          </>
        }
      >
        <label className="relative mt-4 block">
          <span className="sr-only">Search employees</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtlest" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID or email" className={cn(field, 'pl-8')} />
        </label>
        <div role="radiogroup" className="mt-2 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{employees.length === 0 ? 'Every employee record is already linked.' : 'No employees match.'}</p>
          ) : (
            filtered.map((employee) => (
              <label key={employee.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted', employeeId === employee.id && 'bg-accent hover:bg-accent')}>
                <input type="radio" name={`link-${user.id}`} checked={employeeId === employee.id} onChange={() => setEmployeeId(employee.id)} className="size-4 accent-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{employee.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {employee.employeeId}, {employee.email}
                  </span>
                </span>
                {employee.email === user.email && <span className="text-xs font-medium text-primary">Email matches</span>}
              </label>
            ))
          )}
        </div>
      </Dialog>

      <Dialog
        width="sm"
        open={dialog === 'unlink'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Unlink employee record?"
        description={`${user.name} will keep their ${ROLE_INFO[user.role].label.toLowerCase()} access but won’t be able to open ${user.employee?.name ?? 'the linked'}’s payslips.`}
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => unlinkEmployeeAction(user.id))} className={button.primary}>
              {pending ? 'Unlinking' : 'Unlink'}
            </button>
          </>
        }
      />

      <Dialog
        width="sm"
        open={dialog === 'deactivate'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Deactivate ${user.name}?`}
        description="They’ll be signed out within a minute and won’t be able to sign in. Their employee and payroll records are kept. You can reactivate them later."
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setStatusAction(user.id, 'inactive'))}
              className={cn(button.primary, 'bg-danger hover:bg-[#C9372C] active:bg-[#AE2E24]')}
            >
              {pending ? 'Deactivating' : 'Deactivate'}
            </button>
          </>
        }
      />

      <Dialog
        width="sm"
        open={dialog === 'reactivate'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Reactivate ${user.name}?`}
        description={`They’ll be able to sign in again as ${ROLE_INFO[user.role].label.toLowerCase()}, and we’ll email them to let them know.`}
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => setStatusAction(user.id, 'active'))} className={button.primary}>
              {pending ? 'Reactivating' : 'Reactivate'}
            </button>
          </>
        }
      />
    </>
  )
}
