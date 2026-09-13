'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
import { markAllNotificationsRead, setEmailNotifications } from '@/app/portal/notification-actions'
import { useFlags } from './flags'
import { button } from './styles'

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead()
          router.refresh()
        })
      }
      className={button.default}
    >
      <CheckCheck className="size-4" />
      Mark all as read
    </button>
  )
}

export function EmailToggle({ enabled }: { enabled: boolean }) {
  const { showFlag } = useFlags()
  const [on, setOn] = useState(enabled)
  const [pending, startTransition] = useTransition()
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={() => {
          const next = !on
          setOn(next)
          startTransition(async () => {
            await setEmailNotifications(next)
            showFlag({ tone: 'success', title: next ? 'Email notifications turned on.' : 'Email notifications turned off. You’ll still see them here.' })
          })
        }}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 ${on ? 'bg-success' : 'bg-input'}`}
      >
        <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform duration-150 ease-out ${on ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </button>
      <span>
        <span className="block font-medium">Email me too</span>
        <span className="block text-muted-foreground">Get an email for approvals, requests and payslips, so you don’t miss anything while signed out.</span>
      </span>
    </label>
  )
}
