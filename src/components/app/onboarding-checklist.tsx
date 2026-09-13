import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import type { ChecklistView } from '@/lib/checklists'
import { cn } from '@/lib/utils'

const completedOn = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * Role checklist. Every step is a link to where the work happens; steps tick themselves off once the
 * work is done, and stay ticked because completion is stored.
 */
export function OnboardingChecklist({ checklist }: { checklist: ChecklistView }) {
  const total = checklist.steps.length
  const current = checklist.steps.findIndex((s) => !s.done)
  const allDone = checklist.doneCount === total

  return (
    <section aria-labelledby="onboarding-checklist">
      <h2 id="onboarding-checklist" className="text-base font-semibold">
        {checklist.title}
      </h2>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={checklist.doneCount}
          aria-label="Checklist progress"
        >
          <div className="h-full rounded-full bg-success transition-[width] duration-300 ease-out" style={{ width: `${(checklist.doneCount / total) * 100}%` }} />
        </div>
        <span className="num text-xs text-muted-foreground">
          {checklist.doneCount} of {total}
        </span>
      </div>
      {allDone && <p className="mt-2 text-sm text-success">All done. Nice work.</p>}

      <ol className="-mx-2 mt-4 grid gap-0.5">
        {checklist.steps.map((step, index) => {
          const isCurrent = index === current
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                aria-label={step.done ? `${step.label}, completed` : `${step.label}: ${step.cta}`}
                className={cn(
                  'group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isCurrent ? 'bg-accent hover:bg-[#dbe8fe]' : 'hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors duration-200',
                    step.done ? 'border-success bg-success text-white' : isCurrent ? 'border-primary bg-card text-primary' : 'border-input text-subtlest',
                  )}
                >
                  {step.done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', step.done ? 'text-muted-foreground' : 'text-foreground')}>{step.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {step.done && step.completedAt ? `Completed ${completedOn(step.completedAt)}` : step.description}
                  </span>
                  {isCurrent && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {step.cta}
                      <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </span>
                  )}
                </span>
                {!isCurrent && (
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-subtlest opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
