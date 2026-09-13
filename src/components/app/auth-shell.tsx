import Image from 'next/image'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { BRAND, Logo } from '@/lib/brand'

// "Colleagues reviewing brochure in workspace" by Gylain Omer, Unsplash License (free for commercial use).
const AUTH_PHOTO = 'https://images.unsplash.com/photo-1787532378776-2ace7a3e9901?auto=format&fit=crop&w=2000&q=80'

/**
 * Sign-in layout: form column on the left, photo panel on the right.
 * On small screens the photo becomes a short banner above the form.
 */
export function AuthShell({
  aside,
  asideFooter,
  children,
}: {
  aside: React.ReactNode
  asideFooter?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-dvh flex-1 grid-rows-[auto_1fr] bg-card lg:grid-cols-[minmax(0,1fr)_minmax(420px,36%)] lg:grid-rows-1">
      <div className="flex min-w-0 flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-8">
        <Link href="/login" aria-label={`${BRAND.name} sign in`} className="self-start rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo size={32} />
        </Link>

        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{BRAND.copyright}</span>
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" />
            Sign-in protected by one-time codes
          </span>
        </footer>
      </div>

      <aside className="order-first flex flex-col overflow-hidden bg-brand-deep text-white lg:order-last lg:sticky lg:top-0 lg:h-dvh">
        <div className="relative h-40 sm:h-52 lg:h-auto lg:min-h-0 lg:flex-1">
          <Image
            src={AUTH_PHOTO}
            alt="Two colleagues in business attire reviewing a printed document in a bright office"
            fill
            preload
            sizes="(min-width: 1024px) 36vw, 100vw"
            className="object-cover object-[50%_38%] lg:object-[62%_60%]"
          />
          {/* Scrims keep overlay text legible and blend the photo into the navy band below */}
          <div aria-hidden className="absolute inset-0 hidden bg-linear-to-b from-brand-deep from-5% via-brand-deep/75 via-30% to-transparent to-60% lg:block" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 hidden h-24 bg-linear-to-t from-brand-deep to-transparent lg:block" />
          <div aria-hidden className="absolute inset-0 bg-brand-deep/15 lg:hidden" />
          <div className="absolute inset-x-0 top-0 hidden p-8 lg:block xl:p-10">{aside}</div>
        </div>
        {asideFooter && <div className="hidden px-8 pt-2 pb-8 lg:block xl:px-10">{asideFooter}</div>}
      </aside>
    </div>
  )
}

export function AuthCard({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mt-8">
      {children}
      {footer && <div className="mt-8 border-t border-border pt-5">{footer}</div>}
    </div>
  )
}

export function AuthNotice({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger'
          : 'rounded-lg border border-primary/25 bg-accent px-3.5 py-2.5 text-sm text-accent-foreground'
      }
    >
      {children}
    </div>
  )
}
