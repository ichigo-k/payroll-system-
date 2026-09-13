'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CircleAlert, CircleCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type FlagInput = { tone: 'success' | 'error' | 'info'; title: string; description?: string; href?: string }
type Flag = FlagInput & { id: number }
type FlagContextValue = { showFlag: (flag: FlagInput) => void }

const FlagContext = createContext<FlagContextValue | null>(null)
const DISMISS_MS = 6000

/** Atlassian-style flags: short confirmations and live notifications stacked in the bottom-left corner. */
export function FlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Flag[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setFlags((current) => current.filter((flag) => flag.id !== id)), [])
  const showFlag = useCallback((flag: FlagInput) => {
    nextId.current += 1
    setFlags((current) => [...current.slice(-2), { ...flag, id: nextId.current }])
  }, [])
  const value = useMemo(() => ({ showFlag }), [showFlag])

  return (
    <FlagContext.Provider value={value}>
      {children}
      <section aria-label="Notifications" aria-live="polite" className="pointer-events-none fixed bottom-6 left-6 z-50 flex w-[min(400px,calc(100vw-3rem))] flex-col gap-2">
        {flags.map((flag) => (
          <FlagItem key={flag.id} flag={flag} onDismiss={() => dismiss(flag.id)} />
        ))}
      </section>
    </FlagContext.Provider>
  )
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Bell }
const ICON_COLORS = { success: 'text-success', error: 'text-danger', info: 'text-primary' }

function FlagItem({ flag, onDismiss }: { flag: Flag; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (paused) return
    // Live notifications stay a little longer so there's time to act on them
    const timer = setTimeout(() => dismissRef.current(), flag.href ? DISMISS_MS * 1.5 : DISMISS_MS)
    return () => clearTimeout(timer)
  }, [paused, flag.href])

  const Icon = ICONS[flag.tone]
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only pauses auto-dismiss; the buttons are the interactive controls
    <div
      role={flag.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover p-4 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-300 ease-out starting:translate-y-2 starting:opacity-0"
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', ICON_COLORS[flag.tone])} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm text-foreground', flag.description && 'font-semibold')}>{flag.title}</p>
        {flag.description && <p className="mt-1 text-sm text-muted-foreground">{flag.description}</p>}
        {flag.href && (
          <Link href={flag.href} onClick={onDismiss} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            View
          </Link>
        )}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-m-1 rounded p-1 text-subtlest hover:bg-secondary hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  )
}

export function useFlags() {
  const context = useContext(FlagContext)
  if (!context) throw new Error('useFlags must be used inside FlagProvider')
  return context
}
