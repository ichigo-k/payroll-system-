import { Lock } from 'lucide-react'

export function NoPermission({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Lock className="size-5" />
      </div>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
