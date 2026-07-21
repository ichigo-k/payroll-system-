'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { BRAND, Logo } from '@/lib/brand'

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

    const financialRoles = ['ADMIN', 'PREPARER', 'APPROVER']
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
    <div className="flex min-h-screen">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-[#0a0f1a] p-12">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-sm font-semibold text-white">{BRAND.name}</span>
        </div>

        {/* Step context */}
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/25">Step 2 of 2</p>
          <div>
            <h2 className="text-[1.6rem] font-semibold leading-snug text-white">Check your inbox</h2>
            <p className="mt-3 text-sm text-white/50">We sent a 6-digit code to</p>
            <p className="mt-1 break-all text-sm font-semibold text-white">{email}</p>
            <p className="mt-3 text-xs text-white/30">The code expires in 10 minutes.</p>
          </div>

          <div className="rounded-md border border-white/5 bg-white/[0.03] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#3385FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs leading-relaxed text-white/40">
                Check your spam folder if you don&apos;t see it within a minute.
              </p>
            </div>
          </div>
        </div>

        <a href="/login" className="flex items-center gap-1.5 text-xs text-white/25 transition-colors hover:text-white/50">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Use a different email
        </a>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#f9fafb] px-8 py-12">
        <div className="w-full max-w-[480px]">

          {/* Mobile step */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 lg:hidden">Step 2 of 2</p>

          <h1 className="text-2xl font-bold text-gray-900">Enter your code</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sent to <span className="font-medium text-gray-800">{email}</span>
          </p>

          {/* Form card — no shadow, no border */}
          <div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white">

            {/* Card header */}
            <div className="border-b border-gray-100 px-7 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Employee Portal
              </p>
            </div>

            {/* Form body */}
            <div className="px-7 py-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-sm font-medium text-gray-800">
                          One-time code
                        </FormLabel>
                        <FormControl>
                          <InputOTP maxLength={6} disabled={isLoading} {...field}>
                            <InputOTPGroup className="w-full gap-2">
                              {[0, 1, 2, 3, 4, 5].map((i) => (
                                <InputOTPSlot
                                  key={i}
                                  index={i}
                                  className="h-14 flex-1 rounded-lg border-gray-200 text-lg font-semibold text-gray-900 focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/15"
                                />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <p className="text-xs text-slate-400">Enter the 6-digit code sent to your email.</p>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {serverError && (
                    <div
                      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                      role="alert"
                    >
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-slate-700">{serverError}</p>
                    </div>
                  )}

                  {resendMessage && (
                    <div
                      className="flex items-start gap-3 rounded-lg border border-[#CCE0FF] bg-[#E5F0FF] px-4 py-3"
                      role="status"
                    >
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#0066FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-slate-700">{resendMessage}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-12 w-full rounded-lg bg-[#0066FF] text-sm font-semibold text-white hover:bg-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0066FF]/40 focus-visible:ring-offset-2 disabled:bg-[#99C2FF] disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Verifying…
                      </span>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Card footer — resend */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-7 py-4">
              <p className="text-xs text-slate-400">Didn&apos;t receive it?</p>
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || isLoading}
                className="text-xs font-medium text-[#0066FF] hover:text-[#0052CC] hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                {isResending ? 'Resending…' : 'Resend code'}
              </button>
            </div>
          </div>

          {/* Contact / back */}
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start gap-4 px-7 py-5">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Having trouble?</p>
                <p className="mt-1 text-sm text-slate-500">
                  Contact your HR administrator or{' '}
                  <a href="/login" className="text-[#0066FF] hover:underline">
                    use a different email address
                  </a>.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
