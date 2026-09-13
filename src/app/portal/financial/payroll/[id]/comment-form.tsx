'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useFlags } from '@/components/app/flags'
import { button, field } from '@/components/app/styles'
import { safeAction } from '@/lib/safe-action'
import { commentAction } from '../actions'

export function CommentForm({ runId, initials }: { runId: string; initials: string }) {
  const router = useRouter()
  const { showFlag } = useFlags()
  const [body, setBody] = useState('')
  const [focused, setFocused] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!body.trim()) return
    startTransition(async () => {
      const result = await safeAction(() => commentAction(runId, body))
      if (!result.ok) {
        showFlag({ tone: 'error', title: result.message })
        return
      }
      setBody('')
      setFocused(false)
      router.refresh()
    })
  }

  return (
    <div className="flex gap-3">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-deep text-xs font-semibold text-white">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={`comment-${runId}`} className="sr-only">
          Add a comment
        </label>
        <textarea
          id={`comment-${runId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
          rows={focused || body ? 3 : 1}
          maxLength={2000}
          placeholder="Add a comment…"
          className={`${field} h-auto resize-y py-2`}
        />
        {(focused || body) && (
          <div className="mt-2 flex items-center gap-2">
            <button type="button" disabled={pending || !body.trim()} onClick={submit} className={button.primary}>
              {pending ? 'Saving' : 'Comment'}
            </button>
            <button
              type="button"
              onClick={() => {
                setBody('')
                setFocused(false)
              }}
              className={button.subtle}
            >
              Cancel
            </button>
            <span className="text-xs text-subtlest">Ctrl + Enter to send. People involved in this run are notified.</span>
          </div>
        )}
      </div>
    </div>
  )
}
