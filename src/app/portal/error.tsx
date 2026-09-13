'use client'

import { RotateCcw, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { button } from '@/components/app/styles'

/** Friendly fallback for anything that fails while loading a portal page, such as the database being briefly unreachable. */
export default function PortalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
          <WifiOff className="size-6" strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">We couldn’t load this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The connection to the server or database dropped for a moment. Your work is saved; nothing you already submitted was lost. Try again in a few seconds.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className={button.subtle}>
            Go to your workspace
          </Link>
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetrying(true)
              unstable_retry()
              setTimeout(() => setRetrying(false), 1500)
            }}
            className={button.primary}
          >
            <RotateCcw className={`size-4 ${retrying ? 'animate-spin' : ''}`} />
            Try again
          </button>
        </div>
        {error.digest && <p className="num mt-6 text-xs text-subtlest">Reference {error.digest}</p>}
      </div>
    </div>
  )
}
