import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { ArrowDown, ArrowUp, Plus, Search, Upload, X } from 'lucide-react'
import { auth } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button, field, link } from '@/components/app/styles'
import { cn } from '@/lib/utils'
import { EmployeeForm } from './employee-form'
import { BulkImport } from './bulk-import'

export const metadata: Metadata = { title: 'Employees' }

const VIEWS = {
  all: { label: 'All employees', where: () => ({}) },
  active: { label: 'Active', where: () => ({ employmentStatus: 'ACTIVE' }) },
  inactive: { label: 'Not active', where: () => ({ employmentStatus: { not: 'ACTIVE' } }) },
  recent: { label: 'Added in last 30 days', where: () => ({ createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }) },
} satisfies Record<string, { label: string; where: () => Prisma.EmployeeWhereInput }>
type ViewKey = keyof typeof VIEWS

const SORTS = {
  name: { label: 'Name', orderBy: (dir: Prisma.SortOrder) => [{ lastName: dir }, { firstName: dir }] },
  id: { label: 'Employee ID', orderBy: (dir: Prisma.SortOrder) => [{ employeeId: dir }] },
  department: { label: 'Department', orderBy: (dir: Prisma.SortOrder) => [{ department: dir }, { lastName: 'asc' as const }] },
  start: { label: 'Start date', orderBy: (dir: Prisma.SortOrder) => [{ startDate: dir }] },
} satisfies Record<string, { label: string; orderBy: (dir: Prisma.SortOrder) => Prisma.EmployeeOrderByWithRelationInput[] }>
type SortKey = keyof typeof SORTS

type Params = { q: string; view: ViewKey; sort: SortKey; dir: Prisma.SortOrder; panel: string }

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
  if (next.panel) search.set('panel', next.panel)
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
    panel: ['new', 'import'].includes(first(raw.panel) ?? '') ? (first(raw.panel) as string) : '',
  }

  const session = await auth()
  const canEdit = ['ADMIN', 'PREPARER'].includes(session?.user?.role ?? '')

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
              <Link
                href={hrefWith(params, { panel: params.panel === 'import' ? '' : 'import' })}
                aria-pressed={params.panel === 'import'}
                className={cn(button.default, params.panel === 'import' && 'bg-accent text-primary hover:bg-accent')}
              >
                <Upload className="size-4" />
                Import
              </Link>
              <Link href={hrefWith(params, { panel: params.panel === 'new' ? '' : 'new' })} className={button.primary}>
                <Plus className="size-4" />
                Add employee
              </Link>
            </>
          )
        }
      />

      {params.panel && (
        <section aria-labelledby="panel-title" className="panel-enter mb-6 rounded-lg border border-border bg-muted">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 id="panel-title" className="text-base font-semibold">
              {params.panel === 'new' ? 'Add employee' : 'Import employees from a spreadsheet'}
            </h2>
            <Link href={hrefWith(params, { panel: '' })} aria-label="Close panel" className={button.icon}>
              <X className="size-4" />
            </Link>
          </div>
          <div className="px-5 pt-3 pb-5">{params.panel === 'new' ? <EmployeeForm canEdit={canEdit} /> : <BulkImport canEdit={canEdit} />}</div>
        </section>
      )}

      <nav aria-label="List views" className="flex gap-1 overflow-x-auto border-b-2 border-border">
        {viewKeys.map((key) => {
          const active = key === params.view
          return (
            <Link
              key={key}
              href={hrefWith(params, { view: key })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative -mb-0.5 flex h-10 items-center gap-1.5 border-b-2 px-2 text-sm font-medium whitespace-nowrap transition-colors duration-150',
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
                  <Link href={hrefWith(params, { panel: 'new' })} className={button.primary}>
                    Add employee
                  </Link>
                  <Link href={hrefWith(params, { panel: 'import' })} className={button.default}>
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
          <table className="w-full min-w-[760px] text-sm">
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
                <th scope="col" className="px-4 py-0 font-semibold">
                  Status
                </th>
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
                        <p className="truncate font-medium text-foreground">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="num px-4 py-2 font-mono text-xs text-foreground">{employee.employeeId}</td>
                  <td className="px-4 py-2 text-foreground">{employee.department}</td>
                  <td className="num px-4 py-2 text-foreground">
                    {employee.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={employee.employmentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
