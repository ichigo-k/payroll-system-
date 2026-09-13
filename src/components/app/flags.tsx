'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Flag = { id: number; tone: 'success' | 'error'; title: string }
type FlagContextValue = { showFlag: (flag: Omit<Flag, 'id'>) => void }

const FlagContext = createContext<FlagContextValue | null>(null)
const DISMISS_MS = 6000

/** Atlassian-style flags: short confirmations that stack in the bottom-left corner. */
export function FlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Flag[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setFlags((current) => current.filter((flag) => flag.id !== id)), [])
  const showFlag = useCallback((flag: Omit<Flag, 'id'>) => {
    nextId.current += 1
    setFlags((current) => [...current.slice(-2), { ...flag, id: nextId.current }])
  }, [])

  return (
    <FlagContext.Provider value={{ showFlag }}>
      {children}
      <section aria-label="Notifications" aria-live="polite" className="pointer-events-none fixed bottom-6 left-6 z-50 flex w-[min(400px,calc(100vw-3rem))] flex-col gap-2">
        {flags.map((flag) => (
          <FlagItem key={flag.id} flag={flag} onDismiss={() => dismiss(flag.id)} />
        ))}
      </section>
    </FlagContext.Provider>
  )
}

function FlagItem({ flag, onDismiss }: { flag: Flag; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => dismissRef.current(), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [paused])

  const Icon = flag.tone === 'success' ? CircleCheck : CircleAlert
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only pauses auto-dismiss; the close button is the interactive control
    <div
      role={flag.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover p-4 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)] transition-[opacity,transform] duration-300 ease-out starting:translate-y-2 starting:opacity-0"
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', flag.tone === 'success' ? 'text-success' : 'text-danger')} />
      <p className="flex-1 text-sm text-foreground">{flag.title}</p>
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
