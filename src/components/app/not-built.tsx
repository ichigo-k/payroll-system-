import Link from 'next/link'
import { ArrowLeft, Construction } from 'lucide-react'
import { button } from './styles'

export function NotBuilt({ homeHref }: { homeHref: string }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-warning-soft text-warning">
        <Construction className="size-5" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">This page isn&apos;t available yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The link exists in navigation, but this part of the workspace hasn&apos;t been built. If you followed a saved link, the page may have moved.
      </p>
      <Link
        href={homeHref}
        className={`${button.default} mt-6`}
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>
    </div>
  )
}
