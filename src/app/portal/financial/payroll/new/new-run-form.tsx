'use client'

import { CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useFlags } from '@/components/app/flags'
import { Select } from '@/components/app/select'
import { button, field } from '@/components/app/styles'
import { safeAction } from '@/lib/safe-action'
import { createRunAction } from '../actions'

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-GB', { month: 'long' }))

export function NewRunForm({ defaultYear, defaultMonth, takenPeriods }: { defaultYear: number; defaultMonth: number; takenPeriods: string[] }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [year, setYear] = useState(defaultYear)
  const [month, setMonth] = useState(defaultMonth)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const taken = takenPeriods.includes(`${year}-${month}`)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await safeAction(() => createRunAction({ year, month, notes }))
      if (!result.ok || !result.id) {
        setError(result.message)
        return
      }
      showFlag({ tone: 'success', title: result.message })
      router.push(`/portal/financial/payroll/${result.id}`)
    })
  }

  return (
    <form onSubmit={submit} className="border-t border-border">
      <section className="grid gap-4 border-b border-border py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2 className="text-base font-semibold">Pay period</h2>
          <p className="mt-1 text-sm text-muted-foreground">One run per month. It starts as a draft you can recalculate as often as you need.</p>
        </div>
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">Month</span>
            <Select aria-label="Month" value={String(month)} onValueChange={(v) => setMonth(Number(v))} options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))} />
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">Year</span>
            <input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${field} num`} />
          </label>
          {taken && (
            <p className="flex items-center gap-1.5 text-sm text-danger sm:col-span-2">
              <CircleAlert className="size-4 shrink-0" />A run already exists for this period.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 border-b border-border py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Optional. Visible to preparers, approvers and auditors on this run.</p>
        </div>
        <label className="grid max-w-xl gap-1">
          <span className="sr-only">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="For example: includes the September bonus for the sales team"
            className={`${field} h-auto py-2`}
          />
        </label>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card py-3">
        <div aria-live="polite" className="min-h-5 text-sm">
          {error && (
            <p className="flex items-center gap-1.5 text-danger">
              <CircleAlert className="size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/portal/financial/payroll" className={button.subtle}>
            Cancel
          </Link>
          <button type="submit" disabled={pending || taken} className={button.primary}>
            {pending ? 'Calculating pay' : 'Create draft'}
          </button>
        </div>
      </div>
    </form>
  )
}
