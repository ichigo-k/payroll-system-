'use client'

import { useActionState, useEffect, useRef } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { button, field } from '@/components/app/styles'
import { type ActionState, createEmployee } from './actions'

const initialState: ActionState = { status: 'idle' }

const inputClass = field

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the input is passed in as children
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
      <span>
        {required && <abbr title="required" className="mr-0.5 text-danger no-underline">*</abbr>}
        {label}
      </span>
      {children}
    </label>
  )
}

export function EmployeeForm({ canEdit }: { canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(createEmployee, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset()
  }, [state])

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Only administrators and payroll preparers can add employees.</p>
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="First name" required>
          <input required name="firstName" autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Last name" required>
          <input required name="lastName" autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Work email" required>
          <input required type="email" name="email" autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Employee ID" required>
          <input required name="employeeId" autoComplete="off" className={`${inputClass} font-mono`} />
        </Field>
        <Field label="Department">
          <input name="department" defaultValue="General" className={inputClass} />
        </Field>
        <Field label="Start date" required>
          <input required type="date" name="startDate" className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
          {pending ? 'Adding' : 'Add employee'}
        </button>
      </div>
    </form>
  )
}
