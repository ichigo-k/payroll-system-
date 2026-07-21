import { auth } from '@/lib/auth-config'

export default async function SelfServiceDashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'there'

  // Future data queries MUST be scoped to session.user.id to prevent cross-user data exposure
  // Example: await prisma.payslip.findMany({ where: { userId: session.user.id } })

  return (
    <div>

      {/* Page header */}
      <div className="mb-8 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Employee Self Service</p>
        <h1 className="mt-1 text-2xl font-bold">Hello, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">View your payslips and payment history.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
        {[
          { label: 'Latest Payslip', value: '—', sub: 'Not yet available', href: '/portal/self-service/payslips' },
          { label: 'Last Payment', value: '—', sub: 'Not yet available', href: '/portal/self-service/history' },
        ].map((card) => (
          <a
            key={card.label}
            href={card.href}
            className="group flex flex-col bg-card px-6 py-6 transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-primary-foreground/70">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground group-hover:text-primary-foreground/70">{card.sub}</p>
            <span className="mt-4 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">View →</span>
          </a>
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick access</p>
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {[
            { label: 'My Payslips', desc: 'Download monthly payslips', href: '/portal/self-service/payslips' },
            { label: 'Payment History', desc: 'View all past payments', href: '/portal/self-service/history' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="group flex items-center justify-between bg-card px-6 py-5 transition-colors hover:bg-muted"
            >
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}
