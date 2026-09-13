'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import type { ActionResult } from '@/lib/access'
import { ALLOWANCE_SUGGESTIONS, DEDUCTION_SUGGESTIONS, formatPercentChange, SALARY_CHANGE_REASONS, salaryChangePercent } from '@/lib/pay-items'
import { cn } from '@/lib/utils'
import {
  addAllowanceAction,
  addDeductionAction,
  endAllowanceAction,
  endDeductionAction,
  setSalaryAction,
  updateAllowanceAction,
  updateDeductionAction,
  updateStatutoryAction,
} from './pay-actions'

export type PayItem = { id: string; name: string; amount: number; frequency: string; startDate?: string | null; endDate?: string | null }

export type PayDialog =
  | { kind: 'salary' }
  | { kind: 'statutory' }
  | { kind: 'allowance'; item?: PayItem }
  | { kind: 'deduction'; item?: PayItem }
  | { kind: 'end'; item: 'allowance' | 'deduction'; id: string; label: string }
  | null

const today = () => new Date().toISOString().slice(0, 10)
const money = (value: number) => `GHS ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-xs font-semibold text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </span>
  )
}

/** Buttons and dialogs for changing pay. Rendered only for users who can edit salaries. */
export function PayEditor({
  employeeId,
  currentSalary,
  statutory,
  initialDialog = null,
  children,
}: {
  employeeId: string
  currentSalary: number | null
  statutory: { ssnitNumber: string | null; tin: string | null }
  /** Opens a dialog straight away, e.g. when arriving from “Set up pay” on the employees list */
  initialDialog?: PayDialog
  children?: (open: (d: PayDialog) => void) => React.ReactNode
}) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [pending, startTransition] = useTransition()
  const initialForm = (d: PayDialog): Record<string, string> => {
    if (!d) return {}
    if (d.kind === 'salary') return { effectiveFrom: today(), reason: currentSalary ? '' : 'New hire' }
    if (d.kind === 'statutory') return { ssnitNumber: statutory.ssnitNumber ?? '', tin: statutory.tin ?? '' }
    if (d.kind === 'allowance' || d.kind === 'deduction') {
      const item = d.item
      return item
        ? { name: item.name, amount: String(item.amount), frequency: item.frequency, startDate: item.startDate?.slice(0, 10) ?? '', endDate: item.endDate?.slice(0, 10) ?? '' }
        : { frequency: 'monthly' }
    }
    return {}
  }
  const [dialog, setDialog] = useState<PayDialog>(initialDialog)
  const [form, setForm] = useState<Record<string, string>>(() => initialForm(initialDialog))
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const open = (d: PayDialog) => {
    setForm(initialForm(d))
    setDialog(d)
  }
  const close = () => {
    setDialog(null)
    // Drop ?edit=… so a refresh doesn't reopen the dialog
    if (initialDialog) router.replace(`/portal/financial/employees/${employeeId}?tab=pay`, { scroll: false })
  }

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn()
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        close()
        router.refresh()
      }
    })

  const footer = (label: string, onClick: () => void, danger = false) => (
    <>
      <button type="button" onClick={close} className={button.subtle}>
        Cancel
      </button>
      <button type="button" disabled={pending} onClick={onClick} className={cn(button.primary, danger && 'bg-danger hover:bg-[#C9372C] active:bg-[#AE2E24]')}>
        {pending ? 'Saving' : label}
      </button>
    </>
  )

  const amount = Number(form.amount)
  const percent = dialog?.kind === 'salary' && amount > 0 ? salaryChangePercent(currentSalary, amount) : null
  const itemFields = (suggestions: string[], listId: string) => (
    <>
      <label className="grid gap-1 sm:col-span-2">
        <Label required>Name on payslip</Label>
        <input list={listId} value={form.name ?? ''} onChange={set('name')} maxLength={60} placeholder="Type a name or pick a suggestion" autoComplete="off" className={field} />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label className="grid gap-1">
        <Label required>Amount (GHS)</Label>
        <input type="number" min="0" step="0.01" value={form.amount ?? ''} onChange={set('amount')} className={`${field} num`} />
      </label>
      <label className="grid gap-1">
        <Label required>Frequency</Label>
        <select value={form.frequency} onChange={set('frequency')} className={field}>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual (spread monthly)</option>
          <option value="one-time">One-time (next paid run only)</option>
        </select>
      </label>
    </>
  )

  const editingItem = (dialog?.kind === 'allowance' || dialog?.kind === 'deduction') && dialog.item ? dialog.item : null

  return (
    <>
      {children?.(open)}

      <Dialog
        width="sm"
        open={dialog?.kind === 'statutory'}
        onOpenChange={(o) => !o && close()}
        title="SSNIT number and TIN"
        description="Printed on the SSNIT contribution report and the GRA PAYE schedule. Payroll runs flag anyone missing them."
        footer={footer('Save', () => run(() => updateStatutoryAction(employeeId, { ssnitNumber: form.ssnitNumber ?? '', tin: form.tin ?? '' })))}
      >
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <Label>SSNIT number</Label>
            <input value={form.ssnitNumber ?? ''} onChange={set('ssnitNumber')} autoComplete="off" placeholder="C123456789012" className={`${field} font-mono`} />
          </label>
          <label className="grid gap-1">
            <Label>TIN / Ghana Card number</Label>
            <input value={form.tin ?? ''} onChange={set('tin')} autoComplete="off" placeholder="GHA-000000000-0" className={`${field} font-mono`} />
          </label>
        </div>
      </Dialog>

      <Dialog
        width="sm"
        open={dialog?.kind === 'salary'}
        onOpenChange={(o) => !o && close()}
        title={currentSalary ? 'Change basic salary' : 'Set basic salary'}
        description={
          currentSalary
            ? `Currently ${money(currentSalary)} a month. The current salary ends the day before the new one starts, so history is kept. Approvers are notified.`
            : 'Basic salary is what SSNIT is charged on. Once it’s set, this person is included in payroll runs.'
        }
        footer={footer('Save salary', () =>
          run(() => setSalaryAction(employeeId, { amount: form.amount ?? '', effectiveFrom: form.effectiveFrom ?? '', reason: form.reason ?? '', note: form.note ?? '' })),
        )}
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <Label required>New monthly basic (GHS)</Label>
            <input type="number" min="0" step="0.01" value={form.amount ?? ''} onChange={set('amount')} className={`${field} num`} />
            {percent !== null && (
              <span className={cn('num text-xs font-semibold', percent > 0 ? 'text-success' : percent < 0 ? 'text-danger' : 'text-muted-foreground')}>
                {formatPercentChange(percent)} ({percent >= 0 ? '+' : '-'}
                {money(Math.abs(amount - (currentSalary ?? 0)))})
              </span>
            )}
          </label>
          <label className="grid gap-1">
            <Label required>Effective from</Label>
            <input type="date" value={form.effectiveFrom ?? ''} onChange={set('effectiveFrom')} className={field} />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <Label required>Reason</Label>
            <select value={form.reason ?? ''} onChange={set('reason')} className={field}>
              <option value="" disabled>
                Choose a reason
              </option>
              {SALARY_CHANGE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {form.reason === 'Correction' && <span className="text-xs text-muted-foreground">Use the same start date as the current salary to fix its amount in place.</span>}
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <Label>Note</Label>
            <input value={form.note ?? ''} onChange={set('note')} maxLength={200} placeholder="For example, promoted to Senior Accountant" className={field} />
          </label>
        </div>
      </Dialog>

      <Dialog
        width="sm"
        open={dialog?.kind === 'allowance'}
        onOpenChange={(o) => !o && close()}
        title={editingItem ? `Edit ${editingItem.name}` : 'Add allowance'}
        description="Added to gross pay and taxed. The name appears on the payslip."
        footer={footer(editingItem ? 'Save changes' : 'Add allowance', () => {
          const input = { name: form.name ?? '', amount: form.amount ?? '', frequency: form.frequency ?? '' }
          run(() => (editingItem ? updateAllowanceAction(employeeId, editingItem.id, input) : addAllowanceAction(employeeId, input)))
        })}
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{itemFields(ALLOWANCE_SUGGESTIONS, `allowance-names-${employeeId}`)}</div>
      </Dialog>

      <Dialog
        width="sm"
        open={dialog?.kind === 'deduction'}
        onOpenChange={(o) => !o && close()}
        title={editingItem ? `Edit ${editingItem.name}` : 'Add deduction'}
        description="Taken from net pay after PAYE and SSNIT. The name appears on the payslip."
        footer={footer(editingItem ? 'Save changes' : 'Add deduction', () => {
          const input = { name: form.name ?? '', amount: form.amount ?? '', frequency: form.frequency ?? '', startDate: form.startDate ?? '', endDate: form.endDate ?? '' }
          run(() => (editingItem ? updateDeductionAction(employeeId, editingItem.id, input) : addDeductionAction(employeeId, input)))
        })}
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {itemFields(DEDUCTION_SUGGESTIONS, `deduction-names-${employeeId}`)}
          <label className="grid gap-1">
            <Label>Starts</Label>
            <input type="date" value={form.startDate ?? ''} onChange={set('startDate')} className={field} />
          </label>
          <label className="grid gap-1">
            <Label>Ends</Label>
            <input type="date" value={form.endDate ?? ''} onChange={set('endDate')} className={field} />
          </label>
        </div>
      </Dialog>

      <Dialog
        width="sm"
        open={dialog?.kind === 'end'}
        onOpenChange={(o) => !o && close()}
        title={dialog?.kind === 'end' ? `End ${dialog.label}?` : ''}
        description="It stops being paid or deducted from the next recalculated run. Past payslips and the history keep it."
        footer={footer(
          'End it',
          () => {
            if (dialog?.kind !== 'end') return
            run(() => (dialog.item === 'allowance' ? endAllowanceAction(employeeId, dialog.id) : endDeductionAction(employeeId, dialog.id)))
          },
          true,
        )}
      />
    </>
  )
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={button.default}>
      <Plus className="size-4" />
      {label}
    </button>
  )
}

export function RowButtons({ label, onEdit, onEnd }: { label: string; onEdit: () => void; onEnd: () => void }) {
  return (
    <span className="inline-flex gap-0.5">
      <button type="button" aria-label={`Edit ${label}`} onClick={onEdit} className={button.icon}>
        <Pencil className="size-4" />
      </button>
      <button type="button" aria-label={`End ${label}`} onClick={onEnd} className={`${button.icon} hover:bg-danger-soft hover:text-danger`}>
        <Trash2 className="size-4" />
      </button>
    </span>
  )
}
