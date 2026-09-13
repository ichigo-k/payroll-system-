import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, FileText, History, Receipt, UserRound } from 'lucide-react'
import { auth } from '@/lib/auth-config'
import { PageHeader } from '@/components/app/page-header'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'My pay' }

const SUMMARY = [
  { label: 'Latest payslip', hint: 'Available after your first approved payroll' },
  { label: 'Last payment', hint: 'Shown once salary has been paid' },
  { label: 'Gross pay this year', hint: 'Year to date' },
  { label: 'PAYE this year', hint: 'Year to date' },
]

const LINKS = [
  { label: 'Payslips', href: '/portal/self-service/payslips', desc: 'View and download monthly payslips', icon: Receipt },
  { label: 'Payment history', href: '/portal/self-service/history', desc: 'Net payments and the dates they were made', icon: History },
  { label: 'Tax certificate', href: '/portal/self-service/tax', desc: 'Year-to-date statement for GRA filings', icon: FileText },
  { label: 'Profile and bank details', href: '/portal/self-service/profile', desc: 'Contact details and the account you are paid into', icon: UserRound },
]

export default async function SelfServiceDashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName

  return (
    <div>
      <PageHeader title={firstName ? `Hello, ${firstName}` : 'Hello'} description="Your payslips, tax records and payment history." />

      <dl className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        {SUMMARY.map((item, index) => (
          <div key={item.label} className={cn('px-5 first:pl-0', index % 2 === 1 && 'border-l border-border', index === 2 && 'pl-0 lg:border-l lg:pl-5')}>
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-base font-semibold text-subtlest">Not available yet</dd>
            <dd className="mt-0.5 text-xs text-subtlest">{item.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="quick-access">
          <h2 id="quick-access" className="text-base font-semibold">
            Quick access
          </h2>
          <ul className="mt-2 -mx-2">
            {LINKS.map(({ label, href, desc, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{desc}</span>
                  </span>
                  <ChevronRight className="size-4 text-subtlest transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="md:border-l md:border-border md:pl-8">
          <h2 className="text-base font-semibold">Something looks wrong?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions about deductions, SSNIT or your bank details go to your payroll or HR administrator.
          </p>
        </aside>
      </div>
    </div>
  )
}
