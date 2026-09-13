'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Dialog } from '@/components/app/dialog'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import { activateTaxConfiguration, rejectTaxConfiguration } from './actions'

export function TaxReview({ id, mode, blockedReason }: { id: string; mode: 'activate' | 'approve-changes'; blockedReason: string | null }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const act = (fn: () => ReturnType<typeof activateTaxConfiguration>) =>
    startTransition(async () => {
      const result = await fn()
      showFlag({ tone: result.ok ? 'success' : 'error', title: result.message })
      if (result.ok) {
        setOpen(false)
        setReason('')
        router.refresh()
      }
    })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending || !!blockedReason} title={blockedReason ?? undefined} onClick={() => setOpen(true)} className={button.default}>
        Send back
      </button>
      <button
        type="button"
        disabled={pending || !!blockedReason}
        title={blockedReason ?? undefined}
        onClick={() => act(() => activateTaxConfiguration(id))}
        className={button.primary}
      >
        <Check className="size-4" />
        {mode === 'activate' ? 'Activate' : 'Approve changes'}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Send back for changes"
        description="The preparer gets your comments by notification and email."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={button.subtle}>
              Cancel
            </button>
            <button type="button" disabled={pending || reason.trim().length < 3} onClick={() => act(() => rejectTaxConfiguration(id, reason))} className={button.primary}>
              Send back
            </button>
          </>
        }
      >
        <label className="mt-4 grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">
            What needs to change<span className="ml-0.5 text-danger">*</span>
          </span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} className={`${field} h-auto py-2`} />
        </label>
      </Dialog>
    </div>
  )
}
