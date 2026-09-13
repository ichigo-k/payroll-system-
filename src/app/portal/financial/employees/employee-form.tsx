'use client'

import { useActionState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleAlert } from 'lucide-react'
import { BankCombobox } from '@/components/app/bank-combobox'
import { DepartmentCombobox } from '@/components/app/department-combobox'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import { cn } from '@/lib/utils'
import { type ActionState, createEmployee, updateEmployee } from './actions'

const initialState: ActionState = { status: 'idle' }

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid content-start gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-danger">
          <CircleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-subtlest">{hint}</p>
      )}
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export type EmployeeFormInitial = Record<string, string>

export function EmployeeForm({ departments, initial, employeeId }: { departments: string[]; initial?: EmployeeFormInitial; employeeId?: string }) {
  const editing = !!employeeId
  const [state, formAction, pending] = useActionState(editing ? updateEmployee : createEmployee, initialState)
  const router = useRouter()
  const { showFlag } = useFlags()
  const handled = useRef<ActionState | null>(null)
  const errors = state.fieldErrors ?? {}
  const values = state.values ?? initial ?? {}

  useEffect(() => {
    if (state.status !== 'success' || handled.current === state) return
    handled.current = state
    showFlag({ tone: 'success', title: state.message ?? 'Saved.' })
    router.push(state.employeeId ? `/portal/financial/employees/${state.employeeId}` : '/portal/financial/employees')
  }, [state, showFlag, router])

  const inputClass = (key: string) => cn(field, errors[key] && 'border-danger')

  return (
    <form action={formAction} noValidate className="border-t border-border">
      {employeeId && <input type="hidden" name="id" value={employeeId} />}
      <Section title="Personal details" description="How this person appears on payslips and how we reach them.">
        <Field label="First name" htmlFor="firstName" required error={errors.firstName}>
          <input id="firstName" name="firstName" defaultValue={values.firstName} autoComplete="off" aria-invalid={!!errors.firstName} className={inputClass('firstName')} />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={errors.lastName}>
          <input id="lastName" name="lastName" defaultValue={values.lastName} autoComplete="off" aria-invalid={!!errors.lastName} className={inputClass('lastName')} />
        </Field>
        <Field label="Work email" htmlFor="email" required error={errors.email} hint="They’ll use this to sign in to self-service.">
          <input id="email" name="email" defaultValue={values.email} type="email" autoComplete="off" aria-invalid={!!errors.email} className={inputClass('email')} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <input id="phone" name="phone" defaultValue={values.phone} type="tel" autoComplete="off" placeholder="+233" className={field} />
        </Field>
      </Section>

      <Section title="Employment" description="Where they sit in the organisation and when they started.">
        <Field label="Department" htmlFor="department" required error={errors.department} hint="Pick one, or type a new name and choose Add.">
          <DepartmentCombobox id="department" name="department" departments={departments} defaultValue={values.department} required />
        </Field>
        <Field label="Job title" htmlFor="designation">
          <input id="designation" name="designation" defaultValue={values.designation} autoComplete="off" className={field} />
        </Field>
        <Field label="Start date" htmlFor="startDate" required error={errors.startDate}>
          <input id="startDate" name="startDate" defaultValue={values.startDate} type="date" aria-invalid={!!errors.startDate} className={inputClass('startDate')} />
        </Field>
        {editing && (
          <Field
            label="Employment status"
            htmlFor="employmentStatus"
            required
            error={errors.employmentStatus}
            hint={values.employmentStatus === 'TERMINATED' ? 'This person has left. Use Reinstate on their profile to bring them back.' : 'Only active employees are paid. To record someone leaving, use Offboard on their profile.'}
          >
            {values.employmentStatus === 'TERMINATED' ? (
              <select id="employmentStatus" disabled value="TERMINATED" className={field}>
                <option value="TERMINATED">Left the company</option>
              </select>
            ) : (
              <select id="employmentStatus" name="employmentStatus" defaultValue={values.employmentStatus ?? 'ACTIVE'} className={field}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            )}
          </Field>
        )}
      </Section>

      <Section title="Bank details" description="The account their salary is paid into. Changes are flagged to approvers and the employee is emailed.">
        <Field label="Bank name" htmlFor="bankName">
          <BankCombobox id="bankName" name="bankName" defaultValue={values.bankName} />
        </Field>
        <Field label="Account name" htmlFor="accountName">
          <input id="accountName" name="accountName" defaultValue={values.accountName} autoComplete="off" className={field} />
        </Field>
        <Field label="Account number" htmlFor="accountNumber">
          <input id="accountNumber" name="accountNumber" defaultValue={values.accountNumber} inputMode="numeric" autoComplete="off" className={cn(field, 'font-mono')} />
        </Field>
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card py-3">
        <div aria-live="polite" className="min-h-5 text-sm">
          {state.status === 'error' && (
            <p className="flex items-center gap-1.5 text-danger">
              <CircleAlert className="size-4 shrink-0" />
              {state.message}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={employeeId ? `/portal/financial/employees/${employeeId}` : '/portal/financial/employees'} className={button.subtle}>
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={button.primary}>
            {pending ? 'Saving' : editing ? 'Save changes' : 'Add employee'}
          </button>
        </div>
      </div>
    </form>
  )
}
