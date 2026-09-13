'use client'

import { UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import { safeAction } from '@/lib/safe-action'
import { cn } from '@/lib/utils'
import { excludeEmployeeAction, includeEmployeeAction } from '../actions'

const REASONS = ['Unpaid leave', 'Paid separately this month', 'Pay on hold pending investigation', 'Missing bank or statutory details', 'Other']

export function ExcludeButton({ runId, employeeId, name, period }: { runId: string; employeeId: string; name: string; period: string }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () =>
    startTransition(async () => {
      const full = reason === 'Other' ? note.trim() : [reason, note.trim()].filter(Boolean).join(': ')
      const result = await safeAction(() => excludeEmployeeAction(runId, employeeId, full))
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        setOpen(false)
        setReason('')
        setNote('')
        router.refresh()
      }
    })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Leave ${name} out of this run`}
        title="Leave out of this run"
        className={cn(button.icon, 'hover:bg-danger-soft hover:text-danger')}
      >
        <UserMinus className="size-4" />
      </button>
      <Dialog
        width="sm"
        open={open}
        onOpenChange={setOpen}
        title={`Leave ${name} out of ${period}?`}
        description="They won’t be paid in this run. It stays this way when you recalculate, and approvers see the reason. Their record and future runs aren’t affected."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={button.subtle}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !reason || (reason === 'Other' && note.trim().length < 3)}
              onClick={submit}
              className={cn(button.primary, 'bg-danger hover:bg-[#C9372C] active:bg-[#AE2E24]')}
            >
              {pending ? 'Saving' : 'Leave out'}
            </button>
          </>
        }
      >
        <div className="mt-4 grid gap-4">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">
              Reason<span className="ml-0.5 text-danger">*</span>
            </legend>
            {REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name={`exclude-reason-${employeeId}`} value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-primary" />
                {r}
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {reason === 'Other' ? 'Explain' : 'Note'}
              {reason === 'Other' && <span className="ml-0.5 text-danger">*</span>}
            </span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={250} className={cn(field, 'h-auto py-2')} />
          </label>
        </div>
      </Dialog>
    </>
  )
}

export function IncludeButton({ runId, employeeId, name }: { runId: string; employeeId: string; name: string }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await safeAction(() => includeEmployeeAction(runId, employeeId))
          showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
          if (result.ok) router.refresh()
        })
      }
      aria-label={`Include ${name} in this run again`}
      className={button.default}
    >
      {pending ? 'Adding' : 'Include again'}
    </button>
  )
}
