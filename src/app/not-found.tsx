import Link from 'next/link'
import { Logo } from '@/lib/brand'
import { button } from '@/components/app/styles'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <Logo size={28} />
        <p className="num mt-8 text-sm text-muted-foreground">Error 404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The address may be mistyped, or the page may have moved.</p>
        <Link
          href="/"
          className={`${button.primary} mt-6`}
        >
          Go to your workspace
        </Link>
      </div>
    </main>
  )
}
