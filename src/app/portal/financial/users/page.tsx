import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { Lock, Search, UserPlus } from 'lucide-react'
import { can, requirePermission } from '@/lib/access'
import { parsePage } from '@/lib/pagination'
import { Pagination } from '@/components/app/pagination'
import { prisma } from '@/lib/prisma'
import { ROLE_INFO } from '@/lib/roles'
import { accessState } from '@/lib/user-rules'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button, field, link } from '@/components/app/styles'
import { cn } from '@/lib/utils'
import { UserActions } from './user-actions'

export const metadata: Metadata = { title: 'User management' }

const VIEWS = {
  all: { label: 'All users', where: (): Prisma.UserWhereInput => ({}) },
  finance: { label: 'Finance team', where: (): Prisma.UserWhereInput => ({ role: { in: ['ADMIN', 'PREPARER', 'APPROVER', 'AUDITOR'] }, status: 'active' }) },
  employees: { label: 'Employees', where: (): Prisma.UserWhereInput => ({ role: 'EMPLOYEE', status: 'active' }) },
  deactivated: { label: 'Deactivated', where: (): Prisma.UserWhereInput => ({ status: { not: 'active' } }) },
}
type ViewKey = keyof typeof VIEWS

type Params = { q: string; view: ViewKey }

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function hrefWith(params: Params, patch: Partial<Params>) {
  const next = { ...params, ...patch }
  const search = new URLSearchParams()
  if (next.q) search.set('q', next.q)
  if (next.view !== 'all') search.set('view', next.view)
  const qs = search.toString()
  return `/portal/financial/users${qs ? `?${qs}` : ''}`
}

function formatLastSignIn(date: Date | null) {
  if (!date) return 'Never'
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ACCESS_BADGE = { active: 'ACTIVE', invited: 'INVITED', deactivated: 'DEACTIVATED', none: 'INACTIVE' } as const

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('users.view')
  if (!actor) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Lock className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">You don’t have access to user management</h1>
        <p className="mt-2 text-sm text-muted-foreground">User management is for administrators, with read-only access for auditors.</p>
      </div>
    )
  }

  const raw = await searchParams
  const viewParam = first(raw.view) ?? 'all'
  const { page, pageSize, skip, take } = parsePage(raw)
  const canManage = can(actor.role, 'users.manage')
  const params: Params = {
    q: (first(raw.q) ?? '').trim(),
    view: viewParam in VIEWS ? (viewParam as ViewKey) : 'all',
  }

  const searchWhere: Prisma.UserWhereInput = params.q
    ? {
        OR: [
          { email: { contains: params.q, mode: 'insensitive' } },
          { firstName: { contains: params.q, mode: 'insensitive' } },
          { lastName: { contains: params.q, mode: 'insensitive' } },
        ],
      }
    : {}

  const viewKeys = Object.keys(VIEWS) as ViewKey[]
  const [users, total, unlinked, ...viewCounts] = await Promise.all([
    prisma.user.findMany({
      where: { AND: [VIEWS[params.view].where(), searchWhere] },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      orderBy: [{ status: 'asc' }, { role: 'asc' }, { firstName: 'asc' }, { email: 'asc' }],
      skip,
      take,
    }),
    prisma.user.count({ where: { AND: [VIEWS[params.view].where(), searchWhere] } }),
    prisma.employee.findMany({
      where: { userId: null },
      select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 1000,
    }),
    ...viewKeys.map((key) => prisma.user.count({ where: { AND: [VIEWS[key].where(), searchWhere] } })),
  ])
  const counts = Object.fromEntries(viewKeys.map((key, i) => [key, viewCounts[i]])) as Record<ViewKey, number>
  const unlinkedEmployees = unlinked.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, employeeId: e.employeeId, email: e.email }))

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Configuration' }, { label: 'User management', href: '/portal/financial/users' }]}
        title="User management"
        description="Invite people, choose what they can do, and turn access off when they leave."
        actions={
          canManage && (
            <Link href="/portal/financial/users/invite" className={button.primary}>
              <UserPlus className="size-4" />
              Invite user
            </Link>
          )
        }
      />

      <nav aria-label="User views" className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-2px_0_var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      <form action="/portal/financial/users" aria-label="Search users" className="flex flex-wrap items-center gap-2 py-4">
        {params.view !== 'all' && <input type="hidden" name="view" value={params.view} />}
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search users</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtlest" />
          <input name="q" type="search" defaultValue={params.q} placeholder="Search by name or email" className={cn(field, 'pl-8')} />
        </label>
        {params.q && (
          <Link href={hrefWith(params, { q: '' })} className={button.subtle}>
            Clear search
          </Link>
        )}
      </form>

      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">No users match</p>
          <p className="mt-1 text-sm text-muted-foreground">{params.q ? <>Nothing matched &ldquo;{params.q}&rdquo;.</> : 'There’s nobody in this view yet.'}</p>
          <Link href="/portal/financial/users" className={cn(link, 'mt-3 inline-block text-sm')}>
            Show all users
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-semibold">User</th>
                <th scope="col" className="px-4 py-2 font-semibold">Role</th>
                <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2 font-semibold">Employee record</th>
                <th scope="col" className="px-4 py-2 font-semibold">Last sign-in</th>
                <th scope="col" className="w-12 py-2 pl-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
                const initials = ([user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || user.email[0]).toUpperCase()
                const state = accessState(user)
                const isSelf = user.id === actor.id
                return (
                  <tr key={user.id} className={cn('border-b border-border hover:bg-muted', state === 'deactivated' && 'text-muted-foreground')}>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', state === 'deactivated' ? 'bg-secondary text-subtlest' : 'bg-brand-deep text-white')}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            <Link href={`/portal/financial/users/${user.id}`} className="hover:text-primary hover:underline">
                              {name}
                            </Link>
                            {isSelf && <span className="ml-1.5 text-xs font-normal text-subtlest">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-medium text-foreground">{ROLE_INFO[user.role].label}</span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={ACCESS_BADGE[state]} />
                    </td>
                    <td className="px-4 py-2">
                      {user.employee ? (
                        <span className="text-foreground">
                          {user.employee.firstName} {user.employee.lastName}
                          <span className="num ml-1.5 font-mono text-xs text-muted-foreground">{user.employee.employeeId}</span>
                        </span>
                      ) : (
                        <span className="text-subtlest">Not linked</span>
                      )}
                    </td>
                    <td className="num px-4 py-2 text-muted-foreground">{formatLastSignIn(user.lastLogin)}</td>
                    <td className="py-2 pl-2 text-right">
                      {canManage && <UserActions
                        isSelf={isSelf}
                        employees={unlinkedEmployees}
                        user={{
                          id: user.id,
                          name,
                          email: user.email,
                          role: user.role,
                          status: user.status,
                          invited: state === 'invited',
                          employee: user.employee ? { id: user.employee.id, name: `${user.employee.firstName} ${user.employee.lastName}` } : null,
                        }}
                      />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {users.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          noun="users"
          hrefFor={(p, size) => {
            const base = hrefWith(params, {})
            return `${base}${base.includes('?') ? '&' : '?'}page=${p}&size=${size}`
          }}
        />
      )}
    </div>
  )
}
