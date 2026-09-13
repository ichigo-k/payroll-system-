'use client'

import { Menu } from '@base-ui/react/menu'
import { ChevronDown, Ellipsis } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { Select } from '@/components/app/select'
import { button, field } from '@/components/app/styles'
import type { ActionResult } from '@/lib/access'
import { OFFBOARDING_REASONS } from '@/lib/employee-rules'
import { safeAction } from '@/lib/safe-action'
import { cn } from '@/lib/utils'
import { deleteEmployeeAction, offboardEmployeeAction, reinstateEmployeeAction } from './lifecycle-actions'

const itemClass = 'flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm text-foreground outline-none data-disabled:text-subtlest data-highlighted:bg-secondary'
const dangerItem = cn(itemClass, 'text-danger data-highlighted:bg-danger-soft')
const dangerButton = cn(button.primary, 'bg-danger hover:bg-[#C9372C] active:bg-[#AE2E24]')

type Confirm = 'offboard' | 'reinstate' | 'delete' | null

export type EmployeeRowActionsProps = {
  employeeId: string
  name: string
  status: string
  hasPay: boolean
  /** Number of payroll lines; records with history can't be deleted */
  payrollLines: number
  canEditEmployee: boolean
  canEditPay: boolean
  /** On the profile the menu is a labelled button and skips links to the page you're on */
  variant?: 'row' | 'profile'
}

export function EmployeeRowActions({ employeeId, name, status, hasPay, payrollLines, canEditEmployee, canEditPay, variant = 'row' }: EmployeeRowActionsProps) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ endDate: '', reason: '', note: '' })
  const base = `/portal/financial/employees/${employeeId}`
  const terminated = status === 'TERMINATED'

  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await safeAction(action)
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        setConfirm(null)
        after ? after() : router.refresh()
      }
    })

  return (
    <>
      <Menu.Root>
        {variant === 'row' ? (
          <Menu.Trigger aria-label={`Actions for ${name}`} className={cn(button.icon, 'data-popup-open:bg-secondary')}>
            <Ellipsis className="size-4" />
          </Menu.Trigger>
        ) : (
          <Menu.Trigger className={cn(button.default, 'data-popup-open:bg-secondary')}>
            More
            <ChevronDown className="size-4" />
          </Menu.Trigger>
        )}
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="end" className="z-40 outline-none">
            <Menu.Popup className="w-60 origin-(--transform-origin) rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
              {variant === 'row' && (
                <Menu.Item onClick={() => router.push(base)} className={itemClass}>
                  View profile
                </Menu.Item>
              )}
              {variant === 'row' && canEditEmployee && (
                <Menu.Item onClick={() => router.push(`${base}/edit`)} className={itemClass}>
                  Edit details
                </Menu.Item>
              )}
              {canEditPay && !terminated && (
                <Menu.Group>
                  <Menu.Separator className="my-1 h-px bg-border" />
                  <Menu.GroupLabel className="px-2 pt-1.5 pb-1 text-xs font-semibold text-subtlest">Pay</Menu.GroupLabel>
                  <Menu.Item onClick={() => router.push(`${base}?tab=pay&edit=salary`)} className={itemClass}>
                    {hasPay ? 'Change salary' : 'Set up pay'}
                  </Menu.Item>
                  <Menu.Item onClick={() => router.push(`${base}?tab=pay&edit=allowance`)} className={itemClass}>
                    Add allowance
                  </Menu.Item>
                  <Menu.Item onClick={() => router.push(`${base}?tab=pay&edit=deduction`)} className={itemClass}>
                    Add deduction
                  </Menu.Item>
                </Menu.Group>
              )}
              {canEditEmployee && (
                <Menu.Group>
                  <Menu.Separator className="my-1 h-px bg-border" />
                  <Menu.GroupLabel className="px-2 pt-1.5 pb-1 text-xs font-semibold text-subtlest">Employment</Menu.GroupLabel>
                  {terminated ? (
                    <Menu.Item onClick={() => setConfirm('reinstate')} className={itemClass}>
                      Reinstate
                    </Menu.Item>
                  ) : (
                    <Menu.Item
                      onClick={() => {
                        setForm({ endDate: new Date().toISOString().slice(0, 10), reason: '', note: '' })
                        setConfirm('offboard')
                      }}
                      className={dangerItem}
                    >
                      Offboard
                    </Menu.Item>
                  )}
                  <Menu.Item onClick={() => setConfirm('delete')} className={dangerItem}>
                    Delete record
                  </Menu.Item>
                </Menu.Group>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog
        width="sm"
        open={confirm === 'offboard'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Offboard ${name}`}
        description="Their record and pay history are kept. They’re paid up to their last working day in that month’s run, then left out of later runs. Any workspace access ends now; approvers are notified."
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending || !form.endDate || !form.reason} onClick={() => run(() => offboardEmployeeAction(employeeId, form))} className={dangerButton}>
              {pending ? 'Saving' : 'Offboard'}
            </button>
          </>
        }
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Last working day<span className="ml-0.5 text-danger">*</span>
            </span>
            <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={field} />
          </label>
          <div className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Reason<span className="ml-0.5 text-danger">*</span>
            </span>
            <Select
              value={form.reason}
              onValueChange={(reason) => setForm((f) => ({ ...f, reason }))}
              placeholder="Choose a reason"
              options={OFFBOARDING_REASONS.map((r) => ({ value: r, label: r }))}
            />
          </div>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Note</span>
            <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} maxLength={300} className={cn(field, 'h-auto py-2')} />
          </label>
        </div>
      </Dialog>

      <Dialog
        width="sm"
        open={confirm === 'reinstate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Reinstate ${name}?`}
        description="They become active again and their end date is cleared. Set their salary afterwards so they’re included in payroll."
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => reinstateEmployeeAction(employeeId))} className={button.primary}>
              {pending ? 'Saving' : 'Reinstate'}
            </button>
          </>
        }
      />

      <Dialog
        width="sm"
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={payrollLines > 0 ? `${name} can’t be deleted` : `Delete ${name}?`}
        description={
          payrollLines > 0
            ? `They appear in ${payrollLines} payroll ${payrollLines === 1 ? 'run' : 'runs'}. Pay, tax and SSNIT records have to be kept, so offboard them instead.`
            : 'Only for records added by mistake. The employee, their salary, allowances and deductions are removed permanently, and any self-service login is switched off. The audit log keeps a copy of the details.'
        }
        footer={
          payrollLines > 0 ? (
            <button type="button" onClick={() => setConfirm(null)} className={button.primary}>
              OK
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setConfirm(null)} className={button.subtle}>
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => deleteEmployeeAction(employeeId),
                    () => (variant === 'profile' ? router.push('/portal/financial/employees') : router.refresh()),
                  )
                }
                className={dangerButton}
              >
                {pending ? 'Deleting' : 'Delete permanently'}
              </button>
            </>
          )
        }
      />
    </>
  )
}
