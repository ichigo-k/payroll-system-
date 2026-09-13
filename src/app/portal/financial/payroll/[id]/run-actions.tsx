'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { Check, ChevronDown, RefreshCw, Send, Undo2 } from 'lucide-react'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import type { ActionResult } from '@/lib/access'
import { cn } from '@/lib/utils'
import {
  approveRunAction,
  deleteDraftAction,
  markPaidAction,
  recalculateRunAction,
  recallRunAction,
  requestChangesAction,
  submitRunAction,
} from '../actions'

type DialogKind = 'submit' | 'approve' | 'changes' | 'paid' | 'delete' | 'recall' | null

export type RunActionsProps = {
  runId: string
  period: string
  status: string
  headcount: number
  totalNet: string
  canPrepare: boolean
  canApprove: boolean
  /** Why this user can't approve right now, if they're an approver */
  approveBlockedReason: string | null
  canRecall: boolean
  approvers: { id: string; name: string }[]
  flaggedLines: number
}

export function RunActions(props: RunActionsProps) {
  const { runId, period, status, canPrepare, canApprove, approveBlockedReason } = props
  const router = useRouter()
  const { showFlag } = useFlags()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [reviewerId, setReviewerId] = useState('')
  const [comment, setComment] = useState('')

  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await action()
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        setDialog(null)
        setNote('')
        setComment('')
        after ? after() : router.refresh()
      }
    })

  const open = (kind: DialogKind) => {
    setComment('')
    setNote('')
    setDialog(kind)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPrepare && status === 'DRAFT' && (
        <>
          <button type="button" disabled={pending} onClick={() => run(() => recalculateRunAction(runId))} className={button.default}>
            <RefreshCw className={cn('size-4', pending && 'animate-spin')} />
            Recalculate
          </button>
          <button type="button" onClick={() => open('submit')} className={button.primary}>
            <Send className="size-4" />
            Submit for approval
          </button>
        </>
      )}
      {canPrepare && status === 'SUBMITTED' && props.canRecall && (
        <button type="button" onClick={() => open('recall')} className={button.default}>
          <Undo2 className="size-4" />
          Recall
        </button>
      )}
      {canApprove && status === 'SUBMITTED' && (
        <>
          <button type="button" disabled={!!approveBlockedReason} title={approveBlockedReason ?? undefined} onClick={() => open('changes')} className={button.default}>
            Request changes
          </button>
          <button type="button" disabled={!!approveBlockedReason} title={approveBlockedReason ?? undefined} onClick={() => open('approve')} className={button.primary}>
            <Check className="size-4" />
            Approve
          </button>
        </>
      )}
      {canPrepare && status === 'APPROVED' && (
        <button type="button" onClick={() => open('paid')} className={button.primary}>
          <Check className="size-4" />
          Mark as paid
        </button>
      )}
      {canPrepare && status === 'DRAFT' && (
        <Menu.Root>
          <Menu.Trigger aria-label="More actions" className={cn(button.default, 'px-2')}>
            <ChevronDown className="size-4" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={4} align="end" className="z-40 outline-none">
              <Menu.Popup className="w-48 origin-(--transform-origin) rounded-lg border border-border bg-popover p-1 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
                <Menu.Item onClick={() => open('delete')} className="flex cursor-default items-center rounded-md px-2 py-1.5 text-sm text-danger outline-none data-highlighted:bg-danger-soft">
                  Delete draft
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}

      <Dialog
        open={dialog === 'submit'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Submit ${period} payroll for approval?`}
        description="The run locks while it’s being reviewed. You can recall it until someone approves it."
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => submitRunAction(runId, { reviewerId: reviewerId || undefined, note }))} className={button.primary}>
              {pending ? 'Submitting' : 'Submit'}
            </button>
          </>
        }
      >
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Employees</dt>
            <dd className="num font-semibold">{props.headcount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total net pay</dt>
            <dd className="num font-semibold">{props.totalNet}</dd>
          </div>
        </dl>
        {props.flaggedLines > 0 && <p className="mt-3 text-sm text-warning">{props.flaggedLines} lines are flagged for review. Approvers will see the flags.</p>}
        <label className="mt-4 grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Ask someone to review first (optional)</span>
          <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className={field}>
            <option value="">Notify all approvers</option>
            {props.approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-subtlest">They get a direct request. Any approver can still approve, as your approval policy requires.</span>
        </label>
        <label className="mt-4 grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Note for approvers (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className={`${field} h-auto py-2`} />
        </label>
      </Dialog>

      <Dialog
        width="sm"
        open={dialog === 'recall'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Recall this run?"
        description="It goes back to draft so you can make changes. Approvers are told it no longer needs their review."
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => recallRunAction(runId))} className={button.primary}>
              {pending ? 'Recalling' : 'Recall to draft'}
            </button>
          </>
        }
      />

      <Dialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Approve ${period} payroll?`}
        description={`You’re confirming ${props.headcount} payments totalling ${props.totalNet} are correct.`}
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => approveRunAction(runId, comment))} className={button.primary}>
              {pending ? 'Approving' : 'Approve'}
            </button>
          </>
        }
      >
        {props.flaggedLines > 0 && <p className="mt-3 text-sm text-warning">{props.flaggedLines} lines are flagged. Check them on the Employees tab before approving.</p>}
        <label className="mt-4 grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Comment (optional)</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} className={`${field} h-auto py-2`} />
        </label>
      </Dialog>

      <Dialog
        open={dialog === 'changes'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Request changes"
        description="The run goes back to draft and the preparer gets your comments by notification and email."
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending || comment.trim().length < 3} onClick={() => run(() => requestChangesAction(runId, comment))} className={button.primary}>
              {pending ? 'Sending' : 'Send back'}
            </button>
          </>
        }
      >
        <label className="mt-4 grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">
            What needs to change<span className="ml-0.5 text-danger">*</span>
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="For example: Kofi Asante’s transport allowance looks doubled compared with August."
            className={`${field} h-auto py-2`}
          />
        </label>
      </Dialog>

      <Dialog
        width="sm"
        open={dialog === 'paid'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mark as paid?"
        description="Confirm the bank has processed the payments. Payslips become visible to employees and they’re notified."
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => markPaidAction(runId))} className={button.primary}>
              {pending ? 'Saving' : 'Mark as paid'}
            </button>
          </>
        }
      />

      <Dialog
        width="sm"
        open={dialog === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this draft?"
        description="The calculated lines and comments are removed. The deletion stays in the audit log."
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={button.subtle}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteDraftAction(runId), () => router.push('/portal/financial/payroll'))}
              className={cn(button.primary, 'bg-danger hover:bg-[#C9372C] active:bg-[#AE2E24]')}
            >
              {pending ? 'Deleting' : 'Delete draft'}
            </button>
          </>
        }
      />
    </div>
  )
}
