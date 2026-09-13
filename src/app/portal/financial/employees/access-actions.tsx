'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { KeyRound } from 'lucide-react'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { button } from '@/components/app/styles'
import type { ActionResult } from '@/lib/access'
import { FINANCIAL_ROLES, ROLE_INFO, type RoleName } from '@/lib/roles'
import { cn } from '@/lib/utils'
import {
  blockSelfServiceAction,
  grantWorkspaceRoleAction,
  removeWorkspaceAccessAction,
  sendSelfServiceWelcomeAction,
  unblockSelfServiceAction,
} from '../users/actions'
import { RolePicker } from '../users/role-picker'
import { safeAction } from '@/lib/safe-action'

const itemClass =
  'flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm text-foreground outline-none data-disabled:text-subtlest data-highlighted:bg-secondary'

type Confirm = 'role' | 'remove-role' | 'block' | null

export function EmployeeAccessActions({
  employeeId,
  name,
  email,
  state,
  role,
  terminated,
}: {
  employeeId: string
  name: string
  email: string
  state: 'available' | 'signed-in' | 'blocked' | 'unavailable'
  /** Role of the linked login, if any */
  role: RoleName | null
  terminated: boolean
}) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const isFinanceUser = !!role && role !== 'EMPLOYEE'
  const [selectedRole, setSelectedRole] = useState<RoleName | ''>(isFinanceUser ? role : '')

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await safeAction(action)
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        setConfirm(null)
        router.refresh()
      }
    })

  const blocked = state === 'blocked'
  const canUseSelfService = state === 'available' || state === 'signed-in'

  return (
    <>
      <Menu.Root>
        <Menu.Trigger aria-label={`Access for ${name}`} title="Access" className={cn(button.icon, 'data-popup-open:bg-secondary')}>
          <KeyRound className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="end" className="z-40 outline-none">
            <Menu.Popup className="w-64 origin-(--transform-origin) rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
              <Menu.Group>
                <Menu.GroupLabel className="px-2 pt-1.5 pb-1 text-xs font-semibold text-subtlest">Payroll workspace</Menu.GroupLabel>
                <Menu.Item
                  disabled={terminated || blocked}
                  onClick={() => {
                    setSelectedRole(isFinanceUser ? role : '')
                    setConfirm('role')
                  }}
                  className={itemClass}
                >
                  {isFinanceUser ? 'Change workspace role' : 'Give workspace access'}
                </Menu.Item>
                {isFinanceUser && (
                  <Menu.Item onClick={() => setConfirm('remove-role')} className={itemClass}>
                    Remove workspace access
                  </Menu.Item>
                )}
              </Menu.Group>

              <Menu.Separator className="my-1 h-px bg-border" />

              <Menu.Group>
                <Menu.GroupLabel className="px-2 pt-1.5 pb-1 text-xs font-semibold text-subtlest">Self-service</Menu.GroupLabel>
                <Menu.Item disabled={!canUseSelfService} onClick={() => run(() => sendSelfServiceWelcomeAction(employeeId))} className={itemClass}>
                  Email sign-in instructions
                </Menu.Item>
                {blocked ? (
                  <Menu.Item disabled={isFinanceUser} onClick={() => run(() => unblockSelfServiceAction(employeeId))} className={itemClass}>
                    Unblock self-service
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    disabled={!canUseSelfService || isFinanceUser}
                    onClick={() => setConfirm('block')}
                    className={cn(itemClass, 'text-danger data-highlighted:bg-danger-soft')}
                  >
                    Block self-service
                  </Menu.Item>
                )}
              </Menu.Group>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog
        open={confirm === 'role'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={isFinanceUser ? `Change ${name}’s workspace role` : `Give ${name} workspace access`}
        description={
          isFinanceUser
            ? 'They’ll get an email about the change. It applies within a minute, without signing out.'
            : `${name} will get an email at ${email} explaining how to sign in. They keep self-service access to their own payslips.`
        }
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className={button.subtle}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !selectedRole || selectedRole === role}
              onClick={() => selectedRole && run(() => grantWorkspaceRoleAction(employeeId, selectedRole))}
              className={button.primary}
            >
              {pending ? 'Saving' : isFinanceUser ? 'Change role' : 'Give access'}
            </button>
          </>
        }
      >
        <div className="mt-4">
          <RolePicker
            name={`workspace-role-${employeeId}`}
            roles={FINANCIAL_ROLES}
            value={selectedRole}
            onChange={setSelectedRole}
            hint={(r) => (r === role ? `Current role. ${ROLE_INFO[r].summary}` : undefined)}
          />
        </div>
      </Dialog>

      <Dialog
        width="sm"
        open={confirm === 'remove-role'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Remove ${name}’s workspace access?`}
        description={`They’ll lose ${role ? ROLE_INFO[role].label.toLowerCase() : 'workspace'} access within a minute but can still sign in to self-service to see their own payslips.`}
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className={button.subtle}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => removeWorkspaceAccessAction(employeeId))}
              className={cn(button.primary, 'bg-danger hover:bg-[#C9372C] active:bg-[#AE2E24]')}
            >
              {pending ? 'Removing' : 'Remove access'}
            </button>
          </>
        }
      />

      <Dialog
        width="sm"
        open={confirm === 'block'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Block ${name} from self-service?`}
        description="They won’t be able to sign in to view payslips, payment history or tax certificates, and any open session ends within a minute. Their employee record and pay history are kept. You can unblock them later."
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className={button.subtle}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => blockSelfServiceAction(employeeId))}
              className={cn(button.primary, 'bg-danger hover:bg-[#C9372C] active:bg-[#AE2E24]')}
            >
              {pending ? 'Blocking' : 'Block self-service'}
            </button>
          </>
        }
      />
    </>
  )
}
