'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Dialog } from '@/components/app/dialog'
import { button, field } from '@/components/app/styles'

/** Opens a dialog to issue an employment confirmation letter, then shows the PDF in a new tab. */
export function LetterButton({ employeeId, name, canIncludeSalary, hasSalary }: { employeeId: string; name: string; canIncludeSalary: boolean; hasSalary: boolean }) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [purpose, setPurpose] = useState('')
  const [salary, setSalary] = useState(false)

  const href = () => {
    const params = new URLSearchParams()
    if (to.trim()) params.set('to', to.trim())
    if (purpose.trim()) params.set('purpose', purpose.trim())
    if (salary) params.set('salary', '1')
    return `/portal/financial/employees/${employeeId}/letter?${params.toString()}`
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={button.default}>
        <FileText className="size-4" />
        Letter
      </button>
      <Dialog
        width="sm"
        open={open}
        onOpenChange={setOpen}
        title="Employment confirmation letter"
        description={`A signed letter confirming ${name}’s job and dates, for bank loans, visas or tenancy applications. Issuing it is recorded in their history.`}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={button.subtle}>
              Cancel
            </button>
            <a href={href()} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={button.primary}>
              <FileText className="size-4" />
              Create letter
            </a>
          </>
        }
      >
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">Addressed to</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={120} placeholder="To whom it may concern" className={field} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-muted-foreground">Purpose</span>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={160} placeholder="For example, a mortgage application" className={field} />
          </label>
          {canIncludeSalary && (
            <label className={`flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm ${hasSalary ? 'cursor-pointer' : 'opacity-60'}`}>
              <input type="checkbox" checked={salary} disabled={!hasSalary} onChange={(e) => setSalary(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="font-medium text-foreground">Include current monthly pay</span>
                <span className="block text-xs text-muted-foreground">{hasSalary ? 'Basic salary and regular allowances. Leave it out unless they asked for it.' : 'No current salary is set.'}</span>
              </span>
            </label>
          )}
        </div>
      </Dialog>
    </>
  )
}
