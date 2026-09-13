'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, ScrollText, ShieldCheck } from 'lucide-react'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthCard, AuthNotice, AuthShell } from '@/components/app/auth-shell'

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
})

type FormValues = z.infer<typeof schema>

const FEATURES = [
  { title: 'Passwordless sign-in', desc: 'A one-time code is emailed to you each time.', icon: KeyRound },
  { title: 'PAYE and SSNIT built in', desc: 'Statutory deductions calculated on every run.', icon: ShieldCheck },
  { title: 'Full audit trail', desc: 'Every change and approval is logged.', icon: ScrollText },
]

export default function LoginPage() {
  const router = useRouter()
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [serverError, setServerError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    setServerMessage(null)
    setServerError(false)

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      })

      const data = await response.json() as { message: string }

      if (!response.ok) {
        setServerError(true)
        setServerMessage(data.message ?? 'An error occurred. Please try again.')
        setIsLoading(false)
        return
      }

      setServerMessage(data.message)
      sessionStorage.setItem('otp-email', values.email)

      setTimeout(() => {
        router.push('/login/verify')
      }, 1500)
    } catch {
      setServerError(true)
      setServerMessage('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  const sent = !!serverMessage && !serverError

  return (
    <AuthShell
      aside={
        <>
          <h2 className="text-3xl leading-[1.1] font-semibold tracking-tight">Payroll for teams in Ghana</h2>
          <p className="mt-3 text-sm text-white/85">
            Run monthly pay with PAYE and SSNIT worked out for you, then send it for approval in the same place.
          </p>
        </>
      }
      asideFooter={
        <ul className="grid gap-4 border-t border-white/20 pt-5">
          {FEATURES.map(({ title, desc, icon: Icon }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-white/90" strokeWidth={1.75} />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-white/75">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
      }
    >
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">Enter your work email and we&apos;ll send you a one-time code. No password needed.</p>

      <AuthCard
        footer={
          <p className="text-xs text-muted-foreground">
            Employees: use the work email on your payroll record. Can’t sign in? Ask your HR or payroll administrator.
          </p>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-medium text-foreground">Work email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      autoFocus
                      disabled={isLoading || sent}
                      className="h-11 rounded-lg border-input bg-card text-sm text-foreground placeholder:text-muted-foreground hover:bg-muted focus-visible:border-ring focus-visible:bg-card focus-visible:ring-1 focus-visible:ring-ring disabled:bg-muted disabled:opacity-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {serverMessage && <AuthNotice tone={serverError ? 'error' : 'info'}>{serverMessage}</AuthNotice>}

            <Button
              type="submit"
              disabled={isLoading || sent}
              className="pressable h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary-strong disabled:opacity-60"
            >
              {isLoading ? 'Sending code' : sent ? 'Opening verification' : 'Continue'}
            </Button>
          </form>
        </Form>
      </AuthCard>
    </AuthShell>
  )
}
