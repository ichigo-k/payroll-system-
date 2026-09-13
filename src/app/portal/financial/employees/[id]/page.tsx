import { CircleAlert, Pencil, UserX } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BankLogo } from '@/components/app/bank-combobox'
import { CountryFlag } from '@/components/app/country-combobox'
import { HistoryList } from '@/components/app/history-list'
import { ListTabs, queryHref } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'
import { StatusBadge } from '@/components/app/status-badge'
import { button } from '@/components/app/styles'
import { can, requirePermission } from '@/lib/access'
import { countryName } from '@/lib/countries'
import { parsePage } from '@/lib/pagination'
import { payItemName } from '@/lib/pay-items'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { ageOn, genderLabel, nearRetirement, yearsOfService } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { ROLE_INFO } from '@/lib/roles'
import { selfServiceState } from '@/lib/user-rules'
import { EmployeeAccessActions } from '../access-actions'
import { EmployeeRowActions } from '../employee-row-actions'
import { LetterButton } from './letter-button'
import { PayPanel } from './pay-panel'

export const metadata: Metadata = { title: 'Employee' }

const date = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')
const mask = (value: string | null) => (value ? `•••• ${value.slice(-4)}` : '-')
const SELF_SERVICE_BADGE = { 'signed-in': 'SIGNED_IN', available: 'AVAILABLE', blocked: 'BLOCKED', unavailable: 'NO_ACCESS' } as const

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('employees.view')
  if (!actor) return <NoPermission title="You can’t view employees" description="Employee records are available to administrators, preparers, approvers and auditors." />

  const { id } = await params
  const raw = await searchParams
  const canSeePay = can(actor.role, 'salary.view')
  const tabs = [{ key: 'overview', label: 'Overview' }, ...(canSeePay ? [{ key: 'pay', label: 'Pay' }] : []), { key: 'history', label: 'History' }]
  const tab = tabs.some((t) => t.key === raw.tab) ? (raw.tab as string) : 'overview'

  const now = new Date()
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, role: true, status: true, lastLogin: true } },
      salaryConfigs: { where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }, take: 1, select: { id: true } },
      _count: { select: { payrollDetails: true } },
    },
  })
  if (!employee) notFound()
  const canEditEmployee = can(actor.role, 'employees.edit')
  const canEditPay = can(actor.role, 'salary.edit')
  const terminated = employee.employmentStatus === 'TERMINATED'
  const hasPay = employee.salaryConfigs.length > 0
  const offboarding = terminated
    ? await prisma.auditLog.findFirst({
        where: { entityType: 'Employee', entityId: employee.id, changes: { contains: '"offboarded":true' } },
        orderBy: { timestamp: 'desc' },
        select: { changes: true },
      })
    : null
  const offboardingReason = (() => {
    try {
      const c = offboarding?.changes ? JSON.parse(offboarding.changes) : null
      return typeof c?.reason === 'string' ? c.reason : null
    } catch {
      return null
    }
  })()

  const name = `${employee.firstName} ${employee.lastName}`
  const base = `/portal/financial/employees/${employee.id}`
  // Bank details are sensitive: only payroll roles see them in full
  const showBank = canSeePay

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'People' }, { label: 'Employees', href: '/portal/financial/employees' }, { label: name }]}
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={employee.employmentStatus} />
            <span className="font-mono text-xs">{employee.employeeId}</span>
            <span>
              {employee.designation ? `${employee.designation}, ` : ''}
              {employee.department}
            </span>
          </span>
        }
        actions={
          <>
            {can(actor.role, 'employees.access') && (
              <EmployeeAccessActions
                employeeId={employee.id}
                name={name}
                email={employee.email}
                state={selfServiceState(employee)}
                role={employee.user?.role ?? null}
                terminated={employee.employmentStatus === 'TERMINATED'}
              />
            )}
            {(canEditEmployee || canSeePay) && <LetterButton employeeId={employee.id} name={name} canIncludeSalary={canSeePay} hasSalary={hasPay} />}
            {canEditEmployee && (
              <Link href={`${base}/edit`} className={button.default}>
                <Pencil className="size-4" />
                Edit
              </Link>
            )}
            {(canEditEmployee || canEditPay) && (
              <EmployeeRowActions
                variant="profile"
                employeeId={employee.id}
                name={name}
                status={employee.employmentStatus}
                hasPay={hasPay}
                payrollLines={employee._count.payrollDetails}
                canEditEmployee={canEditEmployee}
                canEditPay={canEditPay}
              />
            )}
          </>
        }
      />

      {terminated && (
        <div role="note" className="mb-4 flex items-start gap-3 rounded-lg bg-secondary px-4 py-3 text-sm">
          <UserX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-foreground">
            {name} left{employee.endDate ? ` on ${date(employee.endDate)}` : ''}
            {offboardingReason ? ` (${offboardingReason.toLowerCase()})` : ''}. Their record and pay history are kept; they’re only paid in the run for the month they left.
          </p>
        </div>
      )}
      {!terminated && !hasPay && canSeePay && tab !== 'pay' && (
        <div role="note" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm">
          <CircleAlert className="size-4 shrink-0 text-warning" />
          <p className="flex-1 text-foreground">No salary is set, so {employee.firstName} is left out of payroll runs.</p>
          {canEditPay && (
            <Link href={`${base}?tab=pay&edit=salary`} className={button.default}>
              Set up pay
            </Link>
          )}
        </div>
      )}

      <ListTabs label="Employee sections" tabs={tabs.map((t) => ({ ...t, active: t.key === tab, href: `${base}?tab=${t.key}` }))} />

      {tab === 'overview' && (
        <div className="grid gap-x-10 gap-y-2 py-6 lg:grid-cols-2">
          {[
            {
              title: 'Personal',
              rows: [
                [
                  'Date of birth',
                  employee.dateOfBirth
                    ? canEditEmployee
                      ? `${date(employee.dateOfBirth)} (${ageOn(employee.dateOfBirth)} years)`
                      : `${ageOn(employee.dateOfBirth)} years old`
                    : 'Missing',
                ],
                ['Gender', genderLabel(employee.gender) || '-'],
                ['Nationality', employee.nationality ? countryName(employee.nationality) : '-'],
              ],
            },
            {
              title: 'Contact',
              rows: [
                ['Work email', employee.email],
                ['Phone', employee.phone ?? '-'],
                ['Address', [employee.address, employee.city].filter(Boolean).join(', ') || '-'],
              ],
            },
            {
              title: 'Employment',
              rows: [
                ['Employee ID', employee.employeeId],
                ['Department', employee.department],
                ['Job title', employee.designation ?? '-'],
                [
                  'Start date',
                  `${date(employee.startDate)} (${yearsOfService(employee.startDate, employee.endDate)} ${yearsOfService(employee.startDate, employee.endDate) === 1 ? 'year' : 'years'} of service)`,
                ],
                ['End date', date(employee.endDate)],
              ],
            },
            {
              title: 'Statutory',
              rows: [
                ['SSNIT number', employee.ssnit_number ?? 'Missing'],
                ['TIN / Ghana Card', employee.tin ?? 'Missing'],
              ],
            },
            {
              title: 'Bank',
              rows: [
                ['Bank', employee.bankName ?? 'Missing'],
                ['Account name', employee.accountName ?? '-'],
                ['Account number', showBank ? (employee.accountNumber ?? 'Missing') : mask(employee.accountNumber)],
              ],
            },
            {
              title: 'Access',
              rows: [
                ['Self-service', ''],
                ['Workspace role', employee.user && employee.user.role !== 'EMPLOYEE' ? ROLE_INFO[employee.user.role].label : 'None'],
                ['Last sign-in', employee.user?.lastLogin ? date(employee.user.lastLogin) : 'Never'],
              ],
            },
          ].map((group) => (
            <section key={group.title} className="border-b border-border py-4">
              <h2 className="text-xs font-semibold text-subtlest">{group.title}</h2>
              <dl className="mt-2 grid gap-2">
                {group.rows.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className={value === 'Missing' ? 'font-medium text-danger' : 'text-foreground'}>
                      {label === 'Self-service' ? (
                        <StatusBadge status={SELF_SERVICE_BADGE[selfServiceState(employee)]} />
                      ) : label === 'Nationality' && employee.nationality ? (
                        <span className="flex items-center gap-2">
                          <CountryFlag code={employee.nationality} width={21} />
                          {value}
                        </span>
                      ) : label === 'Date of birth' && employee.dateOfBirth && nearRetirement(employee.dateOfBirth) ? (
                        <span>
                          {value}{' '}
                          <span className="ml-1 inline-flex h-5 items-center rounded-[3px] bg-warning-soft px-1.5 text-[11px] font-semibold text-warning">Retirement age</span>
                        </span>
                      ) : label === 'Bank' && employee.bankName ? (
                        <span className="flex items-center gap-2">
                          <BankLogo name={employee.bankName} size={20} />
                          {value}
                        </span>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      {tab === 'pay' && canSeePay && <PayTab employeeId={employee.id} canEdit={canEditPay} terminated={terminated} base={base} raw={raw} />}
      {tab === 'history' && <HistoryTab employeeId={employee.id} base={base} raw={raw} />}
    </div>
  )
}

async function PayTab({
  employeeId,
  canEdit,
  terminated,
  base,
  raw,
}: {
  employeeId: string
  canEdit: boolean
  terminated: boolean
  base: string
  raw: Record<string, string | string[] | undefined>
}) {
  const edit = ['salary', 'allowance', 'deduction'].includes(String(raw.edit)) ? (raw.edit as 'salary' | 'allowance' | 'deduction') : undefined
  const { page, pageSize, skip, take } = parsePage(raw, 10)
  const [statutory, salaries, allowances, deductions, lines, totalLines] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { ssnit_number: true, tin: true } }),
    prisma.salaryConfiguration.findMany({ where: { employeeId }, orderBy: { effectiveFrom: 'desc' } }),
    prisma.allowance.findMany({ where: { employeeId, isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.deduction.findMany({ where: { employeeId, isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.payrollDetail.findMany({
      where: { employeeId },
      include: { payrollRun: { select: { id: true, month: true, year: true, status: true } } },
      orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }],
      skip,
      take,
    }),
    prisma.payrollDetail.count({ where: { employeeId } }),
  ])

  return (
    <div>
      <PayPanel
        employeeId={employeeId}
        canEdit={canEdit}
        terminated={terminated}
        initialDialog={edit}
        data={{
          statutory: { ssnitNumber: statutory?.ssnit_number ?? null, tin: statutory?.tin ?? null },
          salaries: salaries.map((s) => ({
            id: s.id,
            amount: Number(s.baseSalary),
            from: s.effectiveFrom.toISOString(),
            to: s.effectiveTo?.toISOString() ?? null,
            reason: s.reason,
          })),
          allowances: allowances.map((a) => ({ id: a.id, name: payItemName(a, 'allowance'), amount: Number(a.amount), frequency: a.frequency })),
          deductions: deductions.map((d) => ({
            id: d.id,
            name: payItemName(d, 'deduction'),
            amount: Number(d.amount),
            frequency: d.frequency,
            startDate: d.startDate?.toISOString() ?? null,
            endDate: d.endDate?.toISOString() ?? null,
          })),
        }}
      />

      <section className="py-6">
        <h2 className="text-base font-semibold">Payroll history</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">What this person was paid in each run.</p>
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Not included in any payroll run yet.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Period
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Run status
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      Gross
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      PAYE
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      SSNIT
                    </th>
                    <th scope="col" className="py-2 pl-4 text-right font-semibold">
                      Net pay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b border-border hover:bg-muted">
                      <td className="py-2 pr-4">
                        <Link href={`/portal/financial/payroll/${line.payrollRun.id}`} className="font-medium text-primary hover:underline">
                          {periodLabel(line.payrollRun.month, line.payrollRun.year)}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={line.payrollRun.status} />
                      </td>
                      <td className="num px-4 py-2 text-right">{formatCurrency(Number(line.grossIncome))}</td>
                      <td className="num px-4 py-2 text-right">{formatCurrency(Number(line.paye))}</td>
                      <td className="num px-4 py-2 text-right">{formatCurrency(Number(line.ssnitEmployee))}</td>
                      <td className="num py-2 pl-4 text-right font-semibold">{formatCurrency(Number(line.netPay))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={totalLines} noun="runs" hrefFor={(p, size) => queryHref(base, { tab: 'pay' }, { page: p, size })} />
          </>
        )}
      </section>
    </div>
  )
}

async function HistoryTab({ employeeId, base, raw }: { employeeId: string; base: string; raw: Record<string, string | string[] | undefined> }) {
  const { page, pageSize, skip, take } = parsePage(raw)
  const where = { entityType: 'Employee', entityId: employeeId }
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { timestamp: 'desc' }, skip, take }),
    prisma.auditLog.count({ where }),
  ])
  return (
    <div className="max-w-3xl py-2">
      <HistoryList rows={rows} empty="No changes recorded for this employee yet." />
      {total > 0 && <Pagination page={page} pageSize={pageSize} total={total} noun="changes" hrefFor={(p, size) => queryHref(base, { tab: 'history' }, { page: p, size })} />}
    </div>
  )
}
