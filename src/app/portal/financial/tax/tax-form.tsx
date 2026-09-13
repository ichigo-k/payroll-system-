'use client'

import { useActionState, useState } from 'react'
import { CircleAlert, CircleCheck, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { button, field } from '@/components/app/styles'
import { saveTaxConfiguration, type TaxActionState } from './actions'

export type TaxFormValues = {
  year: number
  month: number
  isActive: boolean
  payeThreshold: string
  personalRelief: string
  spouseExemption: string
  childExemption: string
  ssnitEmployeeRate: string
  ssnitEmployerRate: string
  brackets: { min: number; max: number; rate: number }[]
}

const NO_UPPER_LIMIT = 99_999_999
const MONTHS = ['Whole year', ...Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-GB', { month: 'long' }))]

const inputClass = field

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the input is passed in as children
    <label className={cn('grid content-start gap-1 text-xs font-semibold text-muted-foreground', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-subtlest">{hint}</span>}
    </label>
  )
}

function MoneyInput({ name, defaultValue, disabled }: { name: string; defaultValue: string; disabled: boolean }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">GHS</span>
      <input name={name} type="number" step="0.01" min="0" required defaultValue={defaultValue} disabled={disabled} className={cn(inputClass, 'num pl-11 text-right')} />
    </span>
  )
}

function PercentInput({ name, defaultValue, disabled }: { name: string; defaultValue: string; disabled: boolean }) {
  return (
    <span className="relative block">
      <input name={name} type="number" step="0.01" min="0" max="100" required defaultValue={defaultValue} disabled={disabled} className={cn(inputClass, 'num pr-7 text-right')} />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">%</span>
    </span>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border py-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  )
}

export function TaxForm({ values, canEdit }: { values: TaxFormValues; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState<TaxActionState, FormData>(saveTaxConfiguration, { status: 'idle' })
  const [brackets, setBrackets] = useState(() =>
    values.brackets.map((b) => ({ min: String(b.min), max: b.max >= NO_UPPER_LIMIT ? '' : String(b.max), rate: String(Math.round(b.rate * 10000) / 100) })),
  )
  const disabled = !canEdit || pending

  const serialized = JSON.stringify(
    brackets.map((b) => ({ min: Number(b.min), max: b.max === '' ? NO_UPPER_LIMIT : Number(b.max), rate: Number(b.rate) / 100 })),
  )

  function update(index: number, key: 'min' | 'max' | 'rate', value: string) {
    setBrackets((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  function addBracket() {
    setBrackets((rows) => {
      const last = rows.at(-1)
      const start = last?.max || last?.min || '0'
      return [...rows, { min: start, max: '', rate: '' }]
    })
  }

  return (
    <form action={formAction} className="border-t border-border">
      <input type="hidden" name="payeBrackets" value={serialized} />

      <Section title="Period" description="A whole-year configuration applies to every month unless a month-specific one exists.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tax year">
            <input name="year" type="number" min="2000" max="2100" required defaultValue={values.year} disabled={disabled} className={cn(inputClass, 'num')} />
          </Field>
          <Field label="Applies to">
            <select name="month" defaultValue={values.month} disabled={disabled} className={inputClass}>
              {MONTHS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-1.5 text-sm text-foreground">
            <input name="isActive" type="checkbox" defaultChecked={values.isActive} disabled={disabled} className="size-4 accent-primary" />
            Active configuration
          </label>
        </div>
      </Section>

      <Section title="PAYE brackets" description="Monthly chargeable income bands. Leave the last upper bound empty for no limit.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-1.5 font-medium">From (GHS)</th>
                <th scope="col" className="pb-1.5 pl-2 font-medium">To (GHS)</th>
                <th scope="col" className="w-28 pb-1.5 pl-2 font-medium">Rate</th>
                <th scope="col" className="w-9 pb-1.5"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {brackets.map((row, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id and are only appended or removed
                <tr key={index}>
                  <td className="py-1">
                    <input aria-label={`Bracket ${index + 1} from`} type="number" min="0" step="0.01" required value={row.min} onChange={(e) => update(index, 'min', e.target.value)} disabled={disabled} className={cn(inputClass, 'num text-right')} />
                  </td>
                  <td className="py-1 pl-2">
                    <input aria-label={`Bracket ${index + 1} to`} type="number" min="0" step="0.01" value={row.max} placeholder="No limit" onChange={(e) => update(index, 'max', e.target.value)} disabled={disabled} className={cn(inputClass, 'num text-right placeholder:text-muted-foreground')} />
                  </td>
                  <td className="py-1 pl-2">
                    <span className="relative block">
                      <input aria-label={`Bracket ${index + 1} rate`} type="number" min="0" max="100" step="0.01" required value={row.rate} onChange={(e) => update(index, 'rate', e.target.value)} disabled={disabled} className={cn(inputClass, 'num pr-7 text-right')} />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </span>
                  </td>
                  <td className="py-1 pl-1">
                    <button
                      type="button"
                      aria-label={`Remove bracket ${index + 1}`}
                      onClick={() => setBrackets((rows) => rows.filter((_, i) => i !== index))}
                      disabled={disabled}
                      className={`${button.icon} hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-40`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <button type="button" onClick={addBracket} disabled={disabled} className={`${button.subtle} mt-2 px-2`}>
            <Plus className="size-4" />
            Add bracket
          </button>
        )}
      </Section>

      <Section title="Reliefs and exemptions" description="Monthly amounts deducted from gross income before PAYE is applied.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="PAYE tax-free threshold">
            <MoneyInput name="payeThreshold" defaultValue={values.payeThreshold} disabled={disabled} />
          </Field>
          <Field label="Personal relief">
            <MoneyInput name="personalRelief" defaultValue={values.personalRelief} disabled={disabled} />
          </Field>
          <Field label="Spouse exemption">
            <MoneyInput name="spouseExemption" defaultValue={values.spouseExemption} disabled={disabled} />
          </Field>
          <Field label="Child exemption" hint="Per qualifying child">
            <MoneyInput name="childExemption" defaultValue={values.childExemption} disabled={disabled} />
          </Field>
        </div>
      </Section>

      <Section title="SSNIT contributions" description="Percent of basic salary contributed by the employee and the employer.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Employee rate">
            <PercentInput name="ssnitEmployeeRate" defaultValue={values.ssnitEmployeeRate} disabled={disabled} />
          </Field>
          <Field label="Employer rate">
            <PercentInput name="ssnitEmployerRate" defaultValue={values.ssnitEmployerRate} disabled={disabled} />
          </Field>
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
            {state.status === 'success' && (
              <p className="flex items-center gap-1.5 text-success">
                <CircleCheck className="size-4 shrink-0" />
                {state.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            className={button.primary}
          >
            {pending ? 'Saving' : 'Save configuration'}
          </button>
        </div>
      )}
    </form>
  )
}
