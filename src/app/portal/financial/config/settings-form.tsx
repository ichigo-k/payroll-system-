'use client'

import { useActionState, useEffect, useRef } from 'react'
import { CircleAlert } from 'lucide-react'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import { type SettingsState, saveCompanySettings } from './actions'
import { Select } from '@/components/app/select'
import { CountryFlag } from '@/components/app/country-combobox'
import { CURRENCIES } from '@/lib/currency'

export type SettingsValues = Record<string, string>

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="-mx-3 grid scroll-mt-20 gap-4 rounded-lg border-b border-border px-3 py-6 transition-colors duration-500 target:bg-accent lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid content-start gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Input({ name, label, values, disabled, required, hint, wide }: { name: string; label: string; values: SettingsValues; disabled: boolean; required?: boolean; hint?: string; wide?: boolean }) {
  return (
    <label className={`grid gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      <input name={name} defaultValue={values[name] ?? ''} disabled={disabled} required={required} className={field} />
      {hint && <span className="text-xs text-subtlest">{hint}</span>}
    </label>
  )
}

export function SettingsForm({ values, canEdit, approvers }: { values: SettingsValues; canEdit: boolean; approvers: number }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveCompanySettings, { status: 'idle' })
  const { showFlag } = useFlags()
  const handled = useRef<SettingsState | null>(null)
  const disabled = !canEdit || pending

  useEffect(() => {
    if (state.status === 'success' && handled.current !== state) {
      handled.current = state
      showFlag({ tone: 'success', title: state.message ?? 'Saved.' })
    }
  }, [state, showFlag])

  return (
    <form action={action} className="border-t border-border">
      <Section id="company" title="Company" description="Shown in emails and at the top of statutory documents.">
        <Input name="companyName" label="Company name" values={values} disabled={disabled} required wide />
        <Input name="companyRegistration" label="Registration number" values={values} disabled={disabled} />
        <Input name="address" label="Address" values={values} disabled={disabled} />
      </Section>

      <Section id="currency" title="Currency" description="Shown with every amount: on screen, on payslips, in documents and in exports.">
        <div className="grid gap-1 sm:col-span-2">
          <span className="text-xs font-semibold text-muted-foreground">Currency</span>
          <Select
            name="currency"
            aria-label="Currency"
            defaultValue={values.currency || 'GHS'}
            disabled={disabled}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})`, description: c.symbol, icon: <CountryFlag code={c.country} width={20} /> }))}
          />
          <span className="text-xs text-subtlest">Changing it doesn’t convert existing amounts, and PAYE and SSNIT still follow your tax configuration.</span>
        </div>
      </Section>

      <Section id="statutory" title="Statutory numbers" description="Printed on the PAYE schedule and SSNIT contribution report.">
        <Input name="taxId" label="Employer TIN" values={values} disabled={disabled} hint="GRA taxpayer identification number" />
        <Input name="employerSsnitNumber" label="Employer SSNIT number" values={values} disabled={disabled} />
      </Section>

      <Section id="bank" title="Salary bank account" description="The account salaries are paid from. Shown on the bank payment schedule.">
        <Input name="bankName" label="Bank" values={values} disabled={disabled} />
        <Input name="bankBranch" label="Branch" values={values} disabled={disabled} />
        <Input name="bankAccountName" label="Account name" values={values} disabled={disabled} />
        <Input name="bankAccountNumber" label="Account number" values={values} disabled={disabled} />
      </Section>

      <Section id="approval-policy" title="Approval policy" description="How many different approvers must approve a payroll run. Nobody can approve a run they submitted.">
        <div className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Approvals required per run</span>
          <Select
            name="requiredApprovals"
            aria-label="Approvals required per run"
            defaultValue={String(values.requiredApprovals ?? '1')}
            disabled={disabled}
            options={[1, 2, 3].map((n) => ({
              value: String(n),
              label: `${n} ${n === 1 ? 'approval' : 'approvals'}`,
              description: n > Math.max(1, approvers) ? 'Not enough active approvers' : n === 1 ? 'Any one approver' : `${n} different approvers`,
              disabled: n > Math.max(1, approvers),
            }))}
          />
          <span className="text-xs text-subtlest">
            You have {approvers} active {approvers === 1 ? 'approver' : 'approvers'}. Two approvals is common for larger payrolls.
          </span>
        </div>
      </Section>

      {canEdit && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card py-3">
          <div aria-live="polite" className="min-h-5 text-sm">
            {state.status === 'error' && (
              <p className="flex items-center gap-1.5 text-danger">
                <CircleAlert className="size-4 shrink-0" />
                {state.message}
              </p>
            )}
          </div>
          <button type="submit" disabled={pending} className={button.primary}>
            {pending ? 'Saving' : 'Save settings'}
          </button>
        </div>
      )}
    </form>
  )
}
