'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BRAND, Logo } from '@/lib/brand'

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    setServerMessage(null)

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      })

      const data = await response.json() as { message: string }

      if (!response.ok) {
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
      setServerMessage('An error occurred. Please try again.')
      setIsLoading(false)
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

        {/* Middle */}
        <div className="space-y-6">
          <div>
            <h2 className="text-[1.6rem] font-semibold leading-snug text-white">
              Payroll operations,<br />reimagined for Ghana
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              SSNIT contributions, PAYE deductions, and payslips — all in one place.
            </p>
          </div>

          <div className="space-y-px">
            {[
              {
                title: 'Passwordless sign-in',
                desc: 'Secure one-time codes, no passwords to manage.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
              },
              {
                title: 'Statutory compliance',
                desc: 'SSNIT tiers, PAYE, and deductions handled automatically.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
              },
              {
                title: 'Full audit trail',
                desc: 'Every payroll run is logged and traceable.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 border-b border-white/5 py-4 last:border-0">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#3385FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  {item.icon}
                </svg>
                <div>
                  <p className="text-sm font-medium text-white/90">{item.title}</p>
                  <p className="mt-0.5 text-xs text-white/40">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/20">{BRAND.copyright}</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#f9fafb] px-8 py-12">
        <div className="w-full max-w-[480px]">

          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Logo size={28} />
            <span className="text-sm font-semibold text-gray-900">{BRAND.name}</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter your work email to receive a one-time code.
          </p>

          {/* Form card */}
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
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-sm font-medium text-gray-800">
                          Work email address
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@company.com"
                            autoComplete="email"
                            disabled={isLoading || !!serverMessage}
                            className="h-12 rounded-lg border-gray-200 bg-white text-sm text-gray-900 placeholder:text-slate-400 focus-visible:border-[#0066FF] focus-visible:ring-2 focus-visible:ring-[#0066FF]/15 focus-visible:ring-offset-0 disabled:bg-gray-50 disabled:text-slate-400"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {serverMessage && (
                    <div
                      className="flex items-start gap-3 rounded-lg border border-[#CCE0FF] bg-[#E5F0FF] px-4 py-3"
                      role="status"
                    >
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#0066FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-slate-700">{serverMessage}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || !!serverMessage}
                    className="h-12 w-full rounded-lg bg-[#0066FF] text-sm font-semibold text-white hover:bg-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0066FF]/40 focus-visible:ring-offset-2 disabled:bg-[#99C2FF] disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Sending code…
                      </span>
                    ) : serverMessage ? (
                      'Redirecting…'
                    ) : (
                      'Continue'
                    )}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Card footer */}
            <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-7 py-4">
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-xs text-slate-500">
                Passwordless sign-in — a one-time code will be sent to your email.
              </p>
            </div>
          </div>

          {/* Contact administrator */}
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start gap-4 px-7 py-5">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Don&apos;t have access?</p>
                <p className="mt-1 text-sm text-slate-500">
                  Contact your HR administrator to request an account or reset your access.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
