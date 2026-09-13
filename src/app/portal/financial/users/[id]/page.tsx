import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/access'
import { ACTION_LABELS, actorName, ENTITY_LABELS } from '@/lib/audit-format'
import { parsePage } from '@/lib/pagination'
import { prisma } from '@/lib/prisma'
import { ROLE_INFO } from '@/lib/roles'
import { accessState } from '@/lib/user-rules'
import { HistoryList } from '@/components/app/history-list'
import { ListTabs, queryHref } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'
import { StatusBadge } from '@/components/app/status-badge'

export const metadata: Metadata = { title: 'User' }

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const ACCESS_BADGE = { active: 'ACTIVE', invited: 'INVITED', deactivated: 'DEACTIVATED', none: 'INACTIVE' } as const

function entityHref(type: string, id: string) {
  if (type === 'PayrollRun') return `/portal/financial/payroll/${id}`
  if (type === 'Employee') return `/portal/financial/employees/${id}`
  if (type === 'User') return `/portal/financial/users/${id}`
  if (type === 'TaxConfiguration') return `/portal/financial/tax?id=${id}`
  return null
}

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('users.view')
  if (!actor) return <NoPermission title="You can’t view users" description="User details are available to administrators and auditors." />

  const { id } = await params
  const raw = await searchParams
  const tab = raw.tab === 'changes' ? 'changes' : 'activity'
  const { page, pageSize, skip, take } = parsePage(raw)

  const user = await prisma.user.findUnique({ where: { id }, include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } } })
  if (!user) notFound()
  const name = actorName(user)
  const base = `/portal/financial/users/${user.id}`

  const activityWhere = { userId: user.id }
  const changesWhere = { entityType: 'User', entityId: user.id }
  const [rows, total, changes, changesTotal] = await Promise.all([
    tab === 'activity' ? prisma.auditLog.findMany({ where: activityWhere, orderBy: { timestamp: 'desc' }, skip, take }) : [],
    prisma.auditLog.count({ where: activityWhere }),
    tab === 'changes' ? prisma.auditLog.findMany({ where: changesWhere, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { timestamp: 'desc' }, skip, take }) : [],
    prisma.auditLog.count({ where: changesWhere }),
  ])

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Configuration' }, { label: 'User management', href: '/portal/financial/users' }, { label: name }]}
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={ACCESS_BADGE[accessState(user)]} />
            <span>{ROLE_INFO[user.role].label}</span>
            <span>{user.email}</span>
            {user.employee && (
              <Link href={`/portal/financial/employees/${user.employee.id}`} className="text-primary hover:underline">
                Employee record {user.employee.employeeId}
              </Link>
            )}
            <span>Last sign-in {user.lastLogin ? dateTime(user.lastLogin) : 'never'}</span>
          </span>
        }
      />

      <ListTabs
        label="User sections"
        tabs={[
          { key: 'activity', label: 'What they did', count: total, active: tab === 'activity', href: `${base}?tab=activity` },
          { key: 'changes', label: 'Changes to this user', count: changesTotal, active: tab === 'changes', href: `${base}?tab=changes` },
        ]}
      />

      {tab === 'activity' ? (
        rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No recorded activity yet.</p>
        ) : (
          <>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-semibold">When</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Action</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Record</th>
                    <th scope="col" className="py-2 pl-4 font-semibold">IP address</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const href = entityHref(row.entityType, row.entityId)
                    return (
                      <tr key={row.id} className="border-b border-border hover:bg-muted">
                        <td className="num py-2 pr-4 text-muted-foreground">{dateTime(row.timestamp)}</td>
                        <td className="px-4 py-2 font-medium">{ACTION_LABELS[row.action] ?? row.action}</td>
                        <td className="px-4 py-2">
                          {href ? (
                            <Link href={href} className="text-primary hover:underline">
                              {ENTITY_LABELS[row.entityType] ?? row.entityType}
                            </Link>
                          ) : (
                            (ENTITY_LABELS[row.entityType] ?? row.entityType)
                          )}
                        </td>
                        <td className="num py-2 pl-4 font-mono text-xs text-muted-foreground">{row.ipAddress ?? '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} noun="events" hrefFor={(p, size) => queryHref(base, { tab: 'activity' }, { page: p, size })} />
          </>
        )
      ) : (
        <div className="max-w-3xl">
          <HistoryList rows={changes} empty="No changes recorded for this user yet." />
          {changesTotal > 0 && <Pagination page={page} pageSize={pageSize} total={changesTotal} noun="changes" hrefFor={(p, size) => queryHref(base, { tab: 'changes' }, { page: p, size })} />}
        </div>
      )}
    </div>
  )
}
