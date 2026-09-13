'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleAlert, Info } from 'lucide-react'
import { button, field, link } from '@/components/app/styles'
import { useFlags } from '@/components/app/flags'
import { FINANCIAL_ROLES, type RoleName } from '@/lib/roles'
import { inviteUserAction } from './actions'
import { RolePicker } from './role-picker'

export type UnlinkedEmployee = { id: string; name: string; employeeId: string; email: string }

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid content-start gap-4">{children}</div>
    </section>
  )
}

function Label({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  )
}

export function InviteUserForm({ employees }: { employees: UnlinkedEmployee[] }) {
  const [state, formAction, pending] = useActionState(inviteUserAction, null)
  const router = useRouter()
  const { showFlag } = useFlags()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<RoleName | ''>('')
  const handled = useRef<typeof state>(null)

  // People already on payroll are better given access from the Employees page; the server links them either way
  const match = useMemo(() => employees.find((e) => e.email.toLowerCase() === email.trim().toLowerCase()), [employees, email])

  useEffect(() => {
    if (!state || handled.current === state) return
    handled.current = state
    if (state.ok) {
      showFlag({ tone: 'success', title: state.message })
      router.push('/portal/financial/users')
    }
  }, [state, showFlag, router])

  return (
    <form action={formAction} className="border-t border-border">
      <Section title="Who" description="They’ll get an email with a link to sign in. There’s no password to set up.">
        <div className="grid gap-1">
          <Label htmlFor="invite-email" required>
            Work email
          </Label>
          <input id="invite-email" name="email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
        {match && (
          <p className="flex items-start gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {match.name} is on payroll, so this login will be linked to their employee record and they’ll keep self-service. You can also do this from{' '}
              <Link href={`/portal/financial/employees?q=${encodeURIComponent(match.email)}`} className={link}>
                the Employees page
              </Link>
              .
            </span>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="invite-first">First name</Label>
            <input id="invite-first" name="firstName" autoComplete="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="invite-last">Last name</Label>
            <input id="invite-last" name="lastName" autoComplete="off" value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} />
          </div>
        </div>
      </Section>

      <Section title="Role" description="Controls what they can see and do in the payroll workspace. You can change it later. Employees don’t need an invite to use self-service.">
        <RolePicker name="role" roles={FINANCIAL_ROLES} value={role} onChange={setRole} />
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card py-3">
        <div aria-live="polite" className="min-h-5 text-sm">
          {state && !state.ok && (
            <p className="flex items-center gap-1.5 text-danger">
              <CircleAlert className="size-4 shrink-0" />
              {state.message}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/portal/financial/users" className={button.subtle}>
            Cancel
          </Link>
          <button type="submit" disabled={pending || !role} className={button.primary}>
            {pending ? 'Sending invite' : 'Send invite'}
          </button>
        </div>
      </div>
    </form>
  )
}
