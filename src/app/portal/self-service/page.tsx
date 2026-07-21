import Link from 'next/link'
import { auth } from '@/lib/auth-config'

const SUMMARY = [
  { label: 'Latest payslip', value: '—', sub: 'Not yet available' },
  { label: 'Last payment', value: '—', sub: 'Not yet available' },
  { label: 'YTD gross', value: '—', sub: 'This fiscal year' },
  { label: 'YTD tax paid', value: '—', sub: 'PAYE contributions' },
]

const LINKS = [
  { label: 'My payslips', href: '/portal/self-service/payslips', desc: 'Browse and download monthly payslips as PDF' },
  { label: 'Payment history', href: '/portal/self-service/history', desc: 'Every net payment and disbursement date' },
  { label: 'Tax certificate', href: '/portal/self-service/tax', desc: 'YTD statement for GRA / personal filings' },
  { label: 'Bank & profile', href: '/portal/self-service/profile', desc: 'Update contact and account details' },
]

export default async function SelfServiceDashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'there'

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Employee workspace</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Hello, {firstName}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Your payslips, tax records and payment history — all in one place.</p>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY.map((s) => (
          <div key={s.label} className="flex flex-col justify-between bg-card px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="num mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Links */}
      <section className="rounded-md border border-border bg-card">
        <header className="border-b border-border px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick access</p>
        </header>
        <ul>
          {LINKS.map((l) => (
            <li key={l.href} className="border-b border-border last:border-b-0">
              <Link href={l.href} className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{l.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{l.desc}</p>
                </div>
                <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
