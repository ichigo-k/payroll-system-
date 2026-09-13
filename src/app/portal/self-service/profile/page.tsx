import type { Metadata } from 'next'
import { countryName } from '@/lib/countries'
import { genderLabel } from '@/lib/people'
import { Info } from 'lucide-react'
import { maskAccount, requireSelfServiceEmployee } from '@/lib/self-service'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'

export const metadata: Metadata = { title: 'Profile' }

const date = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '-')

export default async function ProfilePage() {
  const { user, employee } = await requireSelfServiceEmployee()

  const groups = employee
    ? [
        {
          title: 'Personal',
          rows: [
            ['Name', `${employee.firstName} ${employee.lastName}`],
            ['Work email', employee.email],
            ['Phone', employee.phone ?? 'Not on file'],
            ['Date of birth', employee.dateOfBirth ? date(employee.dateOfBirth) : 'Not on file'],
            ['Gender', genderLabel(employee.gender) || 'Not on file'],
            ['Nationality', employee.nationality ? countryName(employee.nationality) : 'Not on file'],
            ['Address', [employee.address, employee.city].filter(Boolean).join(', ') || 'Not on file'],
          ],
        },
        {
          title: 'Employment',
          rows: [
            ['Employee ID', employee.employeeId],
            ['Department', employee.department],
            ['Job title', employee.designation ?? '-'],
            ['Start date', date(employee.startDate)],
          ],
        },
        {
          title: 'Statutory',
          rows: [
            ['SSNIT number', employee.ssnit_number ?? 'Not on file'],
            ['TIN / Ghana Card', employee.tin ?? 'Not on file'],
          ],
        },
        {
          title: 'Salary account',
          rows: [
            ['Bank', employee.bankName ?? 'Not on file'],
            ['Account name', employee.accountName ?? 'Not on file'],
            ['Account number', maskAccount(employee.accountNumber)],
          ],
        },
      ]
    : [{ title: 'Account', rows: [['Email', user.email]] }]

  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile" description={employee ? <StatusBadge status={employee.employmentStatus} /> : undefined} />

      <div role="note" className="mb-6 flex items-start gap-2.5 rounded-lg bg-accent px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>To change any of these details, including where your salary is paid, contact your payroll or HR team. Bank changes are verified and you’ll get an email whenever they happen.</p>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="border-b border-border py-4">
          <h2 className="text-xs font-semibold text-subtlest">{group.title}</h2>
          <dl className="mt-2 grid gap-2">
            {group.rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={value === 'Not on file' ? 'text-warning' : 'text-foreground'}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
