import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { ArrowDown, ArrowUp, Plus, Search, Upload } from 'lucide-react'
import { can, requirePermission } from '@/lib/access'
import { NoPermission } from '@/components/app/no-permission'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button, field, link } from '@/components/app/styles'
import { cn } from '@/lib/utils'
import { EmployeeAccessActions } from './access-actions'
import { EmployeeRowActions } from './employee-row-actions'
import { formatCurrency } from '@/lib/payroll'
import { ROLE_INFO } from '@/lib/roles'
import { selfServiceState } from '@/lib/user-rules'

const SELF_SERVICE_BADGE = { 'signed-in': 'SIGNED_IN', available: 'AVAILABLE', blocked: 'BLOCKED', unavailable: 'NO_ACCESS' } as const

export const metadata: Metadata = { title: 'Employees' }

const VIEWS = {
  all: { label: 'All employees', where: () => ({}) },
  active: { label: 'Active', where: () => ({ employmentStatus: 'ACTIVE' }) },
  inactive: { label: 'Not active', where: () => ({ employmentStatus: { not: 'ACTIVE' } }) },
  nopay: {
    label: 'No pay set',
    where: (): Prisma.EmployeeWhereInput => ({ employmentStatus: 'ACTIVE', salaryConfigs: { none: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] } } }),
  },
} satisfies Record<string, { label: string; where: () => Prisma.EmployeeWhereInput }>
type ViewKey = keyof typeof VIEWS

const SORTS = {
  name: { label: 'Name', orderBy: (dir: Prisma.SortOrder) => [{ lastName: dir }, { firstName: dir }] },
  id: { label: 'Employee ID', orderBy: (dir: Prisma.SortOrder) => [{ employeeId: dir }] },
  department: { label: 'Department', orderBy: (dir: Prisma.SortOrder) => [{ department: dir }, { lastName: 'asc' as const }] },
  start: { label: 'Start date', orderBy: (dir: Prisma.SortOrder) => [{ startDate: dir }] },
} satisfies Record<string, { label: string; orderBy: (dir: Prisma.SortOrder) => Prisma.EmployeeOrderByWithRelationInput[] }>
type SortKey = keyof typeof SORTS

type Params = { q: string; view: ViewKey; sort: SortKey; dir: Prisma.SortOrder }

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function hrefWith(params: Params, patch: Partial<Params>) {
  const next = { ...params, ...patch }
  const search = new URLSearchParams()
  if (next.q) search.set('q', next.q)
  if (next.view !== 'all') search.set('view', next.view)
  if (next.sort !== 'name' || next.dir !== 'asc') {
    search.set('sort', next.sort)
    search.set('dir', next.dir)
  }
  const qs = search.toString()
  return `/portal/financial/employees${qs ? `?${qs}` : ''}`
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams
  const viewParam = first(raw.view) ?? 'all'
  const sortParam = first(raw.sort) ?? 'name'
  const params: Params = {
    q: (first(raw.q) ?? '').trim(),
    view: viewParam in VIEWS ? (viewParam as ViewKey) : 'all',
    sort: sortParam in SORTS ? (sortParam as SortKey) : 'name',
    dir: first(raw.dir) === 'desc' ? 'desc' : 'asc',
  }

  const actor = await requirePermission('employees.view')
  if (!actor) return <NoPermission title="You can’t view employees" description="Employee records are available to administrators, preparers, approvers and auditors." />
  const canEdit = can(actor.role, 'employees.edit')
  const canManageAccess = can(actor.role, 'employees.access')
  const canSeePay = can(actor.role, 'salary.view')
  const canEditPay = can(actor.role, 'salary.edit')
  const now = new Date()

  const searchWhere: Prisma.EmployeeWhereInput = params.q
    ? {
        OR: [
          { firstName: { contains: params.q, mode: 'insensitive' } },
          { lastName: { contains: params.q, mode: 'insensitive' } },
          { email: { contains: params.q, mode: 'insensitive' } },
          { employeeId: { contains: params.q, mode: 'insensitive' } },
          { department: { contains: params.q, mode: 'insensitive' } },
        ],
      }
    : {}

  const viewKeys = Object.keys(VIEWS) as ViewKey[]
  const [employees, totalCount, ...viewCounts] = await Promise.all([
    prisma.employee.findMany({
      where: { AND: [VIEWS[params.view].where(), searchWhere] },
      orderBy: SORTS[params.sort].orderBy(params.dir),
      include: {
        user: { select: { status: true, lastLogin: true, role: true } },
        salaryConfigs: { where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }, orderBy: { effectiveFrom: 'desc' }, take: 1, select: { baseSalary: true } },
        _count: { select: { payrollDetails: true } },
      },
      take: 200,
    }),
    prisma.employee.count(),
    ...viewKeys.map((key) => prisma.employee.count({ where: { AND: [VIEWS[key].where(), searchWhere] } })),
  ])
  const counts = Object.fromEntries(viewKeys.map((key, i) => [key, viewCounts[i]])) as Record<ViewKey, number>

  const sortLabel = `${SORTS[params.sort].label} (${params.dir === 'asc' ? 'ascending' : 'descending'})`

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'People' }, { label: 'Employees', href: '/portal/financial/employees' }]}
        title="Employees"
        description={
          <span className="num">
            {counts[params.view]} {counts[params.view] === 1 ? 'person' : 'people'} in {VIEWS[params.view].label.toLowerCase()}, sorted by {sortLabel}
            {params.q && <>, matching &ldquo;{params.q}&rdquo;</>}
          </span>
        }
        actions={
          canEdit && (
            <>
              <Link href="/portal/financial/employees/import" className={button.default}>
                <Upload className="size-4" />
                Import
              </Link>
              <Link href="/portal/financial/employees/new" className={button.primary}>
                <Plus className="size-4" />
                Add employee
              </Link>
            </>
          )
        }
      />


      <nav aria-label="List views" className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-2px_0_var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {viewKeys.map((key) => {
          const active = key === params.view
          return (
            <Link
              key={key}
              href={hrefWith(params, { view: key })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2 text-sm font-medium whitespace-nowrap transition-colors duration-150',
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
              )}
            >
              {VIEWS[key].label}
              <span className={cn('num rounded-full px-1.5 text-xs', active ? 'bg-accent text-primary' : 'bg-secondary text-muted-foreground')}>{counts[key]}</span>
            </Link>
          )
        })}
      </nav>

      <form action="/portal/financial/employees" aria-label="Search this list" className="flex flex-wrap items-center gap-2 py-4">
        {params.view !== 'all' && <input type="hidden" name="view" value={params.view} />}
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search this list</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtlest" />
          <input name="q" type="search" defaultValue={params.q} placeholder="Search this list" className={cn(field, 'pl-8')} />
        </label>
        {params.q && (
          <Link href={hrefWith(params, { q: '' })} className={button.subtle}>
            Clear search
          </Link>
        )}
      </form>

      {employees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-14 text-center">
          {totalCount === 0 ? (
            <>
              <p className="text-base font-semibold">No employees yet</p>
              <p className="mx-auto mt-1 max-w-[52ch] text-sm text-muted-foreground">
                Add employees one at a time, or import your staff list from a spreadsheet. You need employees before salaries and payroll runs can be set up.
              </p>
              {canEdit && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link href="/portal/financial/employees/new" className={button.primary}>
                    Add employee
                  </Link>
                  <Link href="/portal/financial/employees/import" className={button.default}>
                    Import
                  </Link>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-base font-semibold">No employees match</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {params.q ? <>Nothing matched &ldquo;{params.q}&rdquo;. Try a name, email, employee ID or department.</> : 'Try another list view.'}
              </p>
              <Link href="/portal/financial/employees" className={cn(link, 'mt-3 inline-block text-sm')}>
                Show all employees
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left text-xs text-muted-foreground">
                {(['name', 'id', 'department', 'start'] as SortKey[]).map((key, index) => {
                  const active = params.sort === key
                  const nextDir: Prisma.SortOrder = active && params.dir === 'asc' ? 'desc' : 'asc'
                  const Arrow = params.dir === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={active ? (params.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={cn('py-0 font-semibold', index === 0 ? 'pr-4' : 'px-4')}
                    >
                      <Link
                        href={hrefWith(params, { sort: key, dir: nextDir })}
                        className={cn('group -mx-1 inline-flex h-9 items-center gap-1 rounded px-1 transition-colors duration-150 hover:bg-secondary hover:text-foreground', active && 'text-foreground')}
                      >
                        {SORTS[key].label}
                        <Arrow className={cn('size-3.5', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60')} />
                      </Link>
                    </th>
                  )
                })}
                {canSeePay && (
                  <th scope="col" className="px-4 py-0 text-right font-semibold">
                    Monthly basic
                  </th>
                )}
                <th scope="col" className="px-4 py-0 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-0 font-semibold">
                  Access
                </th>
                {(canEdit || canEditPay) && (
                  <th scope="col" className="w-12 py-0 pl-2">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
                {canManageAccess && (
                  <th scope="col" className="w-12 py-0 pl-2">
                    <span className="sr-only">Access actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-border hover:bg-muted">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary-strong">
                        {initials(employee.firstName, employee.lastName)}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/portal/financial/employees/${employee.id}`} className="block truncate font-medium text-foreground hover:text-primary hover:underline">
                          {employee.firstName} {employee.lastName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="num px-4 py-2 font-mono text-xs text-foreground">{employee.employeeId}</td>
                  <td className="px-4 py-2 text-foreground">{employee.department}</td>
                  <td className="num px-4 py-2 text-foreground">
                    {employee.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  {canSeePay && (
                    <td className="num px-4 py-2 text-right">
                      {employee.salaryConfigs[0] ? (
                        formatCurrency(Number(employee.salaryConfigs[0].baseSalary))
                      ) : employee.employmentStatus === 'TERMINATED' ? (
                        <span className="text-subtlest">-</span>
                      ) : canEditPay ? (
                        <Link href={`/portal/financial/employees/${employee.id}?tab=pay&edit=salary`} className="inline-flex h-6 items-center rounded-[3px] bg-warning-soft px-1.5 font-sans text-xs font-semibold text-warning hover:underline">
                          Set up pay
                        </Link>
                      ) : (
                        <span className="inline-flex h-5 items-center rounded-[3px] bg-warning-soft px-1.5 font-sans text-[11px] font-semibold text-warning">No pay set</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <StatusBadge status={employee.employmentStatus} />
                    {employee.employmentStatus === 'TERMINATED' && employee.endDate && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">Left {employee.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={SELF_SERVICE_BADGE[selfServiceState(employee)]} />
                    {employee.user && employee.user.role !== 'EMPLOYEE' && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{ROLE_INFO[employee.user.role].label}</span>
                    )}
                  </td>
                  {(canEdit || canEditPay) && (
                    <td className="py-2 pl-2 text-right">
                      <EmployeeRowActions
                        employeeId={employee.id}
                        name={`${employee.firstName} ${employee.lastName}`}
                        status={employee.employmentStatus}
                        hasPay={employee.salaryConfigs.length > 0}
                        payrollLines={employee._count.payrollDetails}
                        canEditEmployee={canEdit}
                        canEditPay={canEditPay}
                      />
                    </td>
                  )}
                  {canManageAccess && (
                    <td className="py-2 pl-2 text-right">
                      <EmployeeAccessActions
                        employeeId={employee.id}
                        name={`${employee.firstName} ${employee.lastName}`}
                        email={employee.email}
                        state={selfServiceState(employee)}
                        role={employee.user?.role ?? null}
                        terminated={employee.employmentStatus === 'TERMINATED'}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
