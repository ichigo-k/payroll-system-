'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Mail } from 'lucide-react'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { AuthCard, AuthNotice, AuthShell } from '@/components/app/auth-shell'

const schema = z.object({
  otp: z.string().length(6, 'Please enter the 6-digit code.'),
})

type FormValues = z.infer<typeof schema>

interface VerifyOtpFormProps {
  email: string
}

export function VerifyOtpForm({ email }: VerifyOtpFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { otp: '' },
  })

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    setServerError(null)

    const result = await signIn('credentials', {
      email,
      otp: values.otp,
      redirect: false,
    })

    setIsLoading(false)

    if (result?.error) {
      setServerError('Invalid or expired code. Please try again.')
      form.reset()
      return
    }

    const sessionResponse = await fetch('/api/auth/session')
    const session = await sessionResponse.json() as { user?: { role?: string } }
    const role = session?.user?.role

    const financialRoles = ['ADMIN', 'PREPARER', 'APPROVER', 'AUDITOR']
    if (role && financialRoles.includes(role)) {
      router.push('/portal/financial')
    } else {
      router.push('/portal/self-service')
    }
  }

  async function handleResend() {
    setIsResending(true)
    setResendMessage(null)
    setServerError(null)

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json() as { message: string }
      setResendMessage(data.message)
      form.reset()
    } catch {
      setResendMessage('Failed to resend code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthShell
      aside={
        <>
          <Mail className="size-6 text-white/90" strokeWidth={1.75} />
          <h2 className="mt-4 text-3xl leading-[1.1] font-semibold tracking-tight">Check your inbox</h2>
          <p className="mt-2 text-sm text-white/80">We sent a 6-digit code to</p>
          <p className="mt-0.5 text-sm font-medium break-all">{email}</p>
          <p className="mt-4 max-w-[36ch] text-xs text-white/80">
            The code expires in 10 minutes. If it hasn&apos;t arrived within a minute, check your spam folder.
          </p>
        </>
      }
    >
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" />
        Use a different email
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">Enter your code</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sent to <span className="font-medium break-all text-foreground">{email}</span>
      </p>

      <AuthCard
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Didn&apos;t receive it?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || isLoading}
              className="text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              {isResending ? 'Sending' : 'Resend code'}
            </button>
          </div>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-medium text-foreground">One-time code</FormLabel>
                  <FormControl>
                    <InputOTP maxLength={6} disabled={isLoading} autoFocus {...field}>
                      <InputOTPGroup className="w-full gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className="num h-12 flex-1 rounded-lg! border border-input bg-card text-lg font-semibold text-foreground data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/20"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {serverError && <AuthNotice tone="error">{serverError}</AuthNotice>}
            {resendMessage && <AuthNotice tone="info">{resendMessage}</AuthNotice>}

            <Button
              type="submit"
              disabled={isLoading}
              className="pressable h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary-strong disabled:opacity-60"
            >
              {isLoading ? 'Verifying' : 'Sign in'}
            </Button>
          </form>
        </Form>
      </AuthCard>
    </AuthShell>
  )
}
