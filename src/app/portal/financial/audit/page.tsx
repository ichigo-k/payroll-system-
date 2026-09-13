import { Download, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { queryHref } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'
import { Select } from '@/components/app/select'
import { button, field } from '@/components/app/styles'
import { requirePermission } from '@/lib/access'
import { ACTION_LABELS, actorName, ENTITY_LABELS, fieldChanges, parseChanges } from '@/lib/audit-format'
import { auditWhere, readAuditFilters } from '@/lib/audit-query'
import { markChecklistVisit } from '@/lib/checklists'
import { parsePage } from '@/lib/pagination'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Audit log' }

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function recordHref(type: string, id: string) {
  if (type === 'PayrollRun') return `/portal/financial/payroll/${id}`
  if (type === 'Employee') return `/portal/financial/employees/${id}`
  if (type === 'User') return `/portal/financial/users/${id}`
  if (type === 'TaxConfiguration') return `/portal/financial/tax?id=${id}`
  return null
}

function device(userAgent: string | null) {
  if (!userAgent) return null
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser'
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : ''
  return [browser, os].filter(Boolean).join(' on ')
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('audit.view')
  if (!actor) return <NoPermission title="You can’t view the audit log" description="The audit log is available to administrators, approvers and auditors." />

  await markChecklistVisit(actor, ['admin.review-audit-log', 'approver.review-audit-log', 'auditor.review-audit-log'])
  const raw = await searchParams
  const filters = readAuditFilters(raw)
  const { page, pageSize, skip, take } = parsePage(raw)
  const where = auditWhere(filters)
  const current = { ...filters, size: typeof raw.size === 'string' ? raw.size : undefined }
  const exportQuery = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1])).toString()

  const [rows, total, people] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { timestamp: 'desc' }, skip, take }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true }, orderBy: [{ firstName: 'asc' }, { email: 'asc' }] }),
  ])
  const filtered = Object.values(filters).some(Boolean)

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Insights' }, { label: 'Audit log', href: '/portal/financial/audit' }]}
        title="Audit log"
        description={
          <span className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            Every change, approval, export and sign-in, with who did it and from where. Entries can’t be edited or deleted by anyone.
          </span>
        }
        actions={
          <a href={`/portal/financial/audit/export${exportQuery ? `?${exportQuery}` : ''}`} className={button.default}>
            <Download className="size-4" />
            Export CSV
          </a>
        }
      />

      <form action="/portal/financial/audit" className="grid gap-3 border-y border-border py-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr_0.9fr_auto]">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Search</span>
          <input name="q" type="search" defaultValue={filters.q} placeholder="Name, email, IP or detail" className={field} />
        </label>
        <div className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Person</span>
          <Select
            name="user"
            aria-label="Person"
            defaultValue={filters.user ?? ''}
            options={[{ value: '', label: 'Anyone' }, ...people.map((p) => ({ value: p.id, label: actorName(p) }))]}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Action</span>
          <Select
            name="action"
            aria-label="Action"
            defaultValue={filters.action ?? ''}
            options={[{ value: '', label: 'Any action' }, ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))]}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Record type</span>
          <Select
            name="entity"
            aria-label="Record type"
            defaultValue={filters.entity ?? ''}
            options={[{ value: '', label: 'Any record' }, ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))]}
          />
        </div>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">From</span>
          <input name="from" type="date" defaultValue={filters.from} className={field} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">To</span>
          <input name="to" type="date" defaultValue={filters.to} className={field} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={button.primary}>
            Apply
          </button>
          {filtered && (
            <Link href="/portal/financial/audit" className={button.subtle}>
              Reset
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">No entries match</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a wider date range or fewer filters.</p>
        </div>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border">
            {rows.map((row) => {
              const changes = parseChanges(row.changes)
              const fields = fieldChanges(changes)
              const other = Object.entries(changes).filter(([, v]) => !(v && typeof v === 'object' && 'from' in (v as object)))
              const href = recordHref(row.entityType, row.entityId)
              const hasDetail = fields.length > 0 || other.length > 0 || row.userAgent
              return (
                <li key={row.id} className="py-3">
                  <details className="group">
                    <summary
                      className={`grid cursor-pointer list-none gap-x-4 gap-y-1 text-sm sm:grid-cols-[170px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] ${hasDetail ? '' : 'cursor-default'}`}
                    >
                      <span className="num text-muted-foreground">{dateTime(row.timestamp)}</span>
                      <span>
                        <Link href={`/portal/financial/users/${row.user.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {actorName(row.user)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{row.user.email}</span>
                      </span>
                      <span>
                        <span className="font-medium">{ACTION_LABELS[row.action] ?? row.action}</span>{' '}
                        {href ? (
                          <Link href={href} className="text-primary hover:underline">
                            {(ENTITY_LABELS[row.entityType] ?? row.entityType).toLowerCase()}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{(ENTITY_LABELS[row.entityType] ?? row.entityType).toLowerCase()}</span>
                        )}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{row.ipAddress ?? 'IP not recorded'}</span>
                        {hasDetail && <span className="text-primary group-open:hidden">Details</span>}
                      </span>
                    </summary>
                    {hasDetail && (
                      <div className="mt-2 grid gap-2 rounded-lg bg-muted px-4 py-3 text-sm sm:ml-[186px]">
                        {fields.map((f) => (
                          <p key={f.field} className="flex flex-wrap gap-x-2">
                            <span className="text-muted-foreground">{f.field}:</span>
                            <span className="text-muted-foreground line-through">{f.from}</span>
                            <span aria-hidden>→</span>
                            <span className="font-medium">{f.to}</span>
                          </p>
                        ))}
                        {other.map(([key, value]) => (
                          <p key={key} className="flex flex-wrap gap-x-2">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-mono text-xs break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                          </p>
                        ))}
                        {row.userAgent && <p className="text-xs text-muted-foreground">Device: {device(row.userAgent)}</p>}
                        <p className="font-mono text-xs text-subtlest">Record ID {row.entityId}</p>
                      </div>
                    )}
                  </details>
                </li>
              )
            })}
          </ul>
          <Pagination page={page} pageSize={pageSize} total={total} noun="entries" hrefFor={(p, size) => queryHref('/portal/financial/audit', current, { page: p, size })} />
        </>
      )}
    </div>
  )
}
