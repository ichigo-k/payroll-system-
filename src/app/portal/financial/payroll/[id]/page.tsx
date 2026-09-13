import type { Prisma } from '@prisma/client'
import { CircleCheck, Clock, Download, Eye, FileSpreadsheet, FileText, Lock, MessageSquare, Search, TriangleAlert, UserMinus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListTabs, queryHref } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'
import { StatusBadge } from '@/components/app/status-badge'
import { button, field } from '@/components/app/styles'
import { can, requirePermission } from '@/lib/access'
import { type AuditRow, actorName, describeRunEvent, parseChanges } from '@/lib/audit-format'
import { markChecklistVisit } from '@/lib/checklists'
import { parsePage } from '@/lib/pagination'
import { formatCurrency } from '@/lib/payroll'
import { REVIEW_FLAGS, type ReviewFlag } from '@/lib/payroll-engine'
import { EXPORT_TYPES, type ExportType } from '@/lib/payroll-exports'
import { approvalsRemaining, checkDecision, type RunStatus } from '@/lib/payroll-rules'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { CommentForm } from './comment-form'
import { ExcludeButton, IncludeButton } from './exclusion-controls'
import { RunActions } from './run-actions'

export const metadata: Metadata = { title: 'Payroll run' }

type Params = { id: string }
type SearchParams = Record<string, string | string[] | undefined>

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)
const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const initialsOf = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  ([u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('') || u.email[0]).toUpperCase()

const FLAG_FILTERS: Record<string, { label: string; flags?: ReviewFlag[] }> = {
  all: { label: 'All employees' },
  flagged: { label: 'Flagged', flags: Object.keys(REVIEW_FLAGS) as ReviewFlag[] },
  changes: { label: 'Changes', flags: ['NEW_EMPLOYEE', 'SALARY_CHANGED', 'BANK_CHANGED', 'NET_PAY_JUMP', 'PART_MONTH', 'LEAVER', 'RETIREMENT_AGE'] },
  missing: { label: 'Missing details', flags: ['MISSING_BANK', 'MISSING_SSNIT', 'MISSING_TIN', 'MISSING_DOB'] },
}

export default async function PayrollRunPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const actor = await requirePermission('payroll.view')
  if (!actor) return <NoPermission title="You can’t view payroll" description="Payroll runs are available to preparers, approvers and auditors." />

  const { id } = await params
  const raw = await searchParams
  const tab = ['employees', 'activity', 'documents'].includes(str(raw.tab) ?? '') ? (str(raw.tab) as string) : 'employees'

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      approvedBy: { select: { firstName: true, lastName: true, email: true } },
      decisions: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!run) notFound()

  await markChecklistVisit(actor, ['auditor.review-run'])
  const period = periodLabel(run.month, run.year)
  const base = `/portal/financial/payroll/${run.id}`
  const status = run.status as RunStatus
  const canPrepare = can(actor.role, 'payroll.prepare')
  const canApprove = can(actor.role, 'payroll.approve')

  const [config, approvers, flaggedLines, ownLine, requestedReviewer, exclusionCount] = await Promise.all([
    prisma.systemConfig.findFirst({ where: { isActive: true }, select: { requiredApprovals: true } }),
    prisma.user.findMany({ where: { role: 'APPROVER', status: 'active' }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: 'asc' } }),
    prisma.payrollDetail.count({ where: { payrollRunId: run.id, NOT: { flags: '[]' } } }),
    actor.employeeId
      ? prisma.payrollDetail.findUnique({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: actor.employeeId } }, select: { flags: true } })
      : null,
    run.requestedReviewerId ? prisma.user.findUnique({ where: { id: run.requestedReviewerId }, select: { firstName: true, lastName: true, email: true } }) : null,
    prisma.payrollExclusion.count({ where: { payrollRunId: id } }),
  ])

  const required = Math.max(1, config?.requiredApprovals ?? 1)
  const roundDecisions = run.decisions.filter((d) => d.round === run.submissionRound)
  const approvalsThisRound = roundDecisions.filter((d) => d.decision === 'APPROVED')
  const ownFlags: string[] = ownLine ? JSON.parse(ownLine.flags) : []
  const approveBlockedReason = canApprove
    ? checkDecision({
        status,
        approverId: actor.id,
        submittedById: run.submittedById,
        alreadyDecided: roundDecisions.some((d) => d.userId === actor.id),
        ownPayChanged: ownFlags.some((f) => ['NEW_EMPLOYEE', 'SALARY_CHANGED', 'BANK_CHANGED', 'NET_PAY_JUMP'].includes(f)),
      })
    : null
  const lastChangeRequest = [...run.decisions].reverse().find((d) => d.decision === 'CHANGES_REQUESTED')

  const tabs = [
    { key: 'employees', label: 'Employees', count: run.headcount },
    { key: 'activity', label: 'Activity' },
    { key: 'documents', label: 'Documents' },
  ]

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Payroll' }, { label: 'Payroll runs', href: '/portal/financial/payroll' }, { label: period }]}
        title={`${period} payroll`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={run.status} />
            {run.createdBy && <span>Created by {actorName({ ...run.createdBy, id: '' })}</span>}
            <span>Updated {dateTime(run.updatedAt)}</span>
            {run.status !== 'DRAFT' && run.status !== 'SUBMITTED' && <Lock className="size-3.5" aria-label="Locked" />}
          </span>
        }
        actions={
          <RunActions
            runId={run.id}
            period={period}
            status={run.status}
            headcount={run.headcount}
            totalNet={formatCurrency(Number(run.totalNetPay))}
            canPrepare={canPrepare}
            canApprove={canApprove}
            approveBlockedReason={approveBlockedReason}
            canRecall={approvalsThisRound.length === 0}
            approvers={approvers.map((a) => ({ id: a.id, name: actorName({ ...a }) }))}
            flaggedLines={flaggedLines}
          />
        }
      />

      {/* Status banner */}
      {status === 'DRAFT' && lastChangeRequest && run.rejectionReason && (
        <div role="note" className="mb-5 flex items-start gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-foreground">Changes requested by {actorName(lastChangeRequest.user)}</p>
            <p className="mt-0.5 whitespace-pre-line text-foreground">{lastChangeRequest.comment}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dateTime(lastChangeRequest.createdAt)}. Make the changes, recalculate and submit again.</p>
          </div>
        </div>
      )}
      {status === 'SUBMITTED' && (
        <div role="note" className="mb-5 flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">
              Waiting for approval: {approvalsThisRound.length} of {required} {required === 1 ? 'approval' : 'approvals'}
            </p>
            <p className="mt-0.5 text-foreground">
              Submitted by {run.submittedBy ? actorName(run.submittedBy) : 'a preparer'}
              {run.submittedAt && ` on ${dateTime(run.submittedAt)}`}
              {requestedReviewer && `. Review requested from ${actorName({ ...requestedReviewer, id: '' })}`}.
            </p>
            {approvalsThisRound.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Approved by {approvalsThisRound.map((d) => actorName(d.user)).join(', ')}.</p>}
            {canApprove && approveBlockedReason && <p className="mt-1 text-xs text-muted-foreground">{approveBlockedReason}</p>}
            {approvalsRemaining(required, approvalsThisRound.length) > 0 && canApprove && !approveBlockedReason && (
              <p className="mt-1 text-xs text-muted-foreground">Your review is needed.</p>
            )}
          </div>
        </div>
      )}
      {(status === 'APPROVED' || status === 'PAID') && (
        <div role="note" className="mb-5 flex items-start gap-3 rounded-lg bg-success-soft px-4 py-3 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-foreground">
            Approved by {approvalsThisRound.map((d) => actorName(d.user)).join(', ') || (run.approvedBy ? actorName({ ...run.approvedBy, id: '' }) : 'an approver')}
            {run.approvedAt && ` on ${dateTime(run.approvedAt)}`}.
            {status === 'PAID' && run.paidAt ? ` Marked as paid on ${dateTime(run.paidAt)}; payslips are visible to employees.` : ''}
          </p>
        </div>
      )}

      {/* Totals */}
      <dl className="grid grid-cols-2 gap-y-4 border-y border-border py-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Employees', String(run.headcount)],
          ['Gross pay', formatCurrency(Number(run.totalGross))],
          ['PAYE', formatCurrency(Number(run.totalTax))],
          ['SSNIT (employee)', formatCurrency(Number(run.totalSsnit))],
          ['SSNIT (employer)', formatCurrency(Number(run.totalEmployerSsnit))],
          ['Net pay', formatCurrency(Number(run.totalNetPay))],
        ].map(([label, value]) => (
          <div key={label} className="pr-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn('num mt-0.5 text-lg font-semibold tracking-tight', label === 'Net pay' && 'text-primary')}>{value}</dd>
          </div>
        ))}
      </dl>
      {run.notes && <p className="mt-3 text-sm text-muted-foreground">Notes: {run.notes}</p>}
      {exclusionCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-foreground">
          <UserMinus className="size-4 text-warning" />
          {exclusionCount} {exclusionCount === 1 ? 'employee was' : 'employees were'} left out of this run.{' '}
          <Link href={`${base}?tab=employees#excluded`} className="text-primary hover:underline">
            See why
          </Link>
        </p>
      )}

      <div className="mt-5">
        <ListTabs label="Run sections" tabs={tabs.map((t) => ({ ...t, active: t.key === tab, href: `${base}?tab=${t.key}` }))} />
      </div>

      {tab === 'employees' && <EmployeesTab runId={run.id} period={period} base={base} raw={raw} editable={canPrepare && status === 'DRAFT'} />}
      {tab === 'activity' && <ActivityTab runId={run.id} actor={actor} canComment={can(actor.role, 'payroll.comment')} />}
      {tab === 'documents' && <DocumentsTab runId={run.id} base={base} status={run.status} canExport={can(actor.role, 'reports.export')} />}
    </div>
  )
}

async function EmployeesTab({ runId, period, base, raw, editable }: { runId: string; period: string; base: string; raw: SearchParams; editable: boolean }) {
  const q = (str(raw.q) ?? '').trim()
  const filter = str(raw.filter) && FLAG_FILTERS[str(raw.filter) as string] ? (str(raw.filter) as string) : 'all'
  const { page, pageSize, skip, take } = parsePage(raw)
  const current = { tab: 'employees', q: q || undefined, filter: filter === 'all' ? undefined : filter, size: str(raw.size) }

  const flagWhere = (key: string): Prisma.PayrollDetailWhereInput => {
    const flags = FLAG_FILTERS[key].flags
    return flags ? { OR: flags.map((f) => ({ flags: { contains: `"${f}"` } })) } : {}
  }
  const searchWhere: Prisma.PayrollDetailWhereInput = q
    ? { OR: [{ employeeName: { contains: q, mode: 'insensitive' } }, { employeeCode: { contains: q, mode: 'insensitive' } }, { department: { contains: q, mode: 'insensitive' } }] }
    : {}
  const where = (key: string): Prisma.PayrollDetailWhereInput => ({ AND: [{ payrollRunId: runId }, flagWhere(key), searchWhere] })

  const keys = Object.keys(FLAG_FILTERS)
  const [exclusions, lines, total, ...counts] = await Promise.all([
    prisma.payrollExclusion.findMany({
      where: { payrollRunId: runId },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true, department: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payrollDetail.findMany({ where: where(filter), orderBy: { employeeName: 'asc' }, skip, take }),
    prisma.payrollDetail.count({ where: where(filter) }),
    ...keys.map((key) => prisma.payrollDetail.count({ where: where(key) })),
  ])

  const excluders = await prisma.user.findMany({
    where: { id: { in: [...new Set(exclusions.map((e) => e.createdById))] } },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  const excluderName = (userId: string) => {
    const user = excluders.find((u) => u.id === userId)
    return user ? actorName(user) : 'Unknown user'
  }

  return (
    <div>
      {exclusions.length > 0 && (
        <section id="excluded" className="mt-4 scroll-mt-20 rounded-lg border border-border">
          <div className="border-b border-border bg-warning-soft/60 px-4 py-2.5">
            <h3 className="text-sm font-semibold">Left out of this run ({exclusions.length})</h3>
            <p className="text-xs text-muted-foreground">Not paid in {period}. This holds when the run is recalculated.</p>
          </div>
          <ul>
            {exclusions.map((ex) => {
              const name = `${ex.employee.firstName} ${ex.employee.lastName}`
              return (
                <li key={ex.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 text-sm last:border-b-0">
                  <div className="min-w-[180px] flex-1">
                    <Link href={`/portal/financial/employees/${ex.employeeId}`} className="font-medium hover:text-primary hover:underline">
                      {name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{ex.employee.employeeId}</span> · {ex.employee.department}
                    </p>
                  </div>
                  <div className="min-w-[220px] flex-[2]">
                    <p className="text-foreground">{ex.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      By {excluderName(ex.createdById)} on {dateTime(ex.createdAt)}
                    </p>
                  </div>
                  {editable && <IncludeButton runId={runId} employeeId={ex.employeeId} name={name} />}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {keys.map((key, i) => (
            <Link
              key={key}
              href={queryHref(base, current, { filter: key === 'all' ? undefined : key })}
              aria-current={key === filter ? 'true' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm',
                key === filter ? 'border-primary bg-accent font-medium text-primary' : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {FLAG_FILTERS[key].label}
              <span className="num text-xs">{counts[i]}</span>
            </Link>
          ))}
        </div>
        <form action={base} className="relative w-full lg:w-72">
          <input type="hidden" name="tab" value="employees" />
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <label className="sr-only" htmlFor="line-search">
            Search employees in this run
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtlest" />
          <input id="line-search" name="q" type="search" defaultValue={q} placeholder="Search by name, ID or department" className={cn(field, 'pl-8')} />
        </form>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-12 text-center">
          <p className="text-base font-semibold">{total === 0 && !q && filter === 'all' ? 'No employees in this run' : 'No employees match'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 && !q && filter === 'all' ? 'Set salaries for active employees, then recalculate.' : 'Try another filter or search.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Employee
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Basic
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Allowances
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Gross
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    SSNIT
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    PAYE
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Other deductions
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Net pay
                  </th>
                  <th scope="col" className="py-2 pl-3 font-semibold">
                    Review
                  </th>
                  {editable && (
                    <th scope="col" className="w-10 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const flags: ReviewFlag[] = JSON.parse(line.flags)
                  return (
                    <tr key={line.id} className="border-b border-border align-top hover:bg-muted">
                      <td className="py-2.5 pr-4">
                        <Link href={`/portal/financial/employees/${line.employeeId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {line.employeeName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{line.employeeCode}</span> · {line.department}
                        </p>
                      </td>
                      <td className="num px-3 py-2.5 text-right">{formatCurrency(Number(line.baseSalary))}</td>
                      <td className="num px-3 py-2.5 text-right">{formatCurrency(Number(line.allowancesTotal))}</td>
                      <td className="num px-3 py-2.5 text-right">{formatCurrency(Number(line.grossIncome))}</td>
                      <td className="num px-3 py-2.5 text-right">{formatCurrency(Number(line.ssnitEmployee))}</td>
                      <td className="num px-3 py-2.5 text-right">{formatCurrency(Number(line.paye))}</td>
                      <td className="num px-3 py-2.5 text-right">{formatCurrency(Number(line.deductionsTotal))}</td>
                      <td className="num px-3 py-2.5 text-right font-semibold">{formatCurrency(Number(line.netPay))}</td>
                      <td className="py-2.5 pl-3">
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {flags.length === 0 ? (
                            <span className="text-xs text-subtlest">None</span>
                          ) : (
                            flags.map((flag) => (
                              <span
                                key={flag}
                                className={cn(
                                  'inline-flex h-5 items-center rounded-[3px] px-1.5 text-[11px] font-semibold',
                                  flag.startsWith('MISSING')
                                    ? 'bg-danger-soft text-danger'
                                    : flag === 'NEW_EMPLOYEE'
                                      ? 'bg-accent text-primary-strong'
                                      : 'bg-warning-soft text-warning',
                                )}
                              >
                                {REVIEW_FLAGS[flag]}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      {editable && (
                        <td className="py-2 text-right">
                          <ExcludeButton runId={runId} employeeId={line.employeeId} name={line.employeeName} period={period} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} noun="employees" hrefFor={(p, size) => queryHref(base, current, { page: p, size })} />
        </>
      )}
    </div>
  )
}

async function ActivityTab({ runId, actor, canComment }: { runId: string; actor: { firstName: string | null; lastName: string | null; email: string }; canComment: boolean }) {
  const [events, comments] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: 'PayrollRun', entityId: runId, action: { not: 'COMMENT' } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: 200,
    }),
    prisma.payrollComment.findMany({
      where: { payrollRunId: runId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  type Item = { key: string; at: Date; kind: 'event'; row: AuditRow } | { key: string; at: Date; kind: 'comment'; comment: (typeof comments)[number] }
  const items: Item[] = [
    ...events.map((row) => ({ key: `e-${row.id}`, at: row.timestamp, kind: 'event' as const, row })),
    ...comments.map((comment) => ({ key: `c-${comment.id}`, at: comment.createdAt, kind: 'comment' as const, comment })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime())

  return (
    <div className="max-w-3xl py-5">
      {canComment && (
        <div className="mb-6">
          <CommentForm runId={runId} initials={initialsOf(actor)} />
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border">
          {items.map((item) =>
            item.kind === 'comment' ? (
              <li key={item.key} className="relative flex gap-3">
                <span
                  aria-hidden
                  className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-deep text-xs font-semibold text-white ring-4 ring-background"
                >
                  {initialsOf(item.comment.user)}
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-border px-4 py-3">
                  <p className="text-sm">
                    <span className="font-semibold">{actorName(item.comment.user)}</span> <span className="text-muted-foreground">commented</span>
                    <span className="ml-2 text-xs text-subtlest">{dateTime(item.at)}</span>
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-line text-foreground">{item.comment.body}</p>
                </div>
              </li>
            ) : (
              <li key={item.key} className="relative flex gap-3">
                <span aria-hidden className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-4 ring-background">
                  {item.row.action === 'APPROVE' || item.row.action === 'MARK_PAID' ? (
                    <CircleCheck className="size-4 text-success" />
                  ) : item.row.action === 'REJECT' ? (
                    <TriangleAlert className="size-4 text-warning" />
                  ) : item.row.action === 'DOWNLOAD' ? (
                    <Download className="size-4" />
                  ) : (
                    <MessageSquare className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1 pt-1.5">
                  <p className="text-sm">
                    <span className="font-semibold">{actorName(item.row.user)}</span> <span className="text-foreground">{describeRunEvent(item.row)}</span>
                    <span className="ml-2 text-xs text-subtlest">{dateTime(item.at)}</span>
                  </p>
                  {(() => {
                    const c = parseChanges(item.row.changes)
                    const text = typeof c.comment === 'string' ? c.comment : typeof c.note === 'string' ? c.note : null
                    return text ? <p className="mt-1.5 rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line">{text}</p> : null
                  })()}
                </div>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  )
}

const FORMAT_LABELS = { pdf: 'PDF', xlsx: 'Excel', csv: 'CSV' } as const

async function DocumentsTab({ runId, base, status, canExport }: { runId: string; base: string; status: string; canExport: boolean }) {
  const company = await prisma.systemConfig.findFirst({ where: { isActive: true }, select: { bankName: true, bankAccountNumber: true, taxId: true, employerSsnitNumber: true } })
  const missingCompany = [
    !company?.bankName || !company?.bankAccountNumber ? 'the salary bank account' : null,
    !company?.taxId ? 'the employer TIN' : null,
    !company?.employerSsnitNumber ? 'the employer SSNIT number' : null,
  ].filter(Boolean)
  const reports = await prisma.report.findMany({
    where: { payrollRunId: runId },
    include: { generatedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { generatedAt: 'desc' },
    take: 20,
  })
  const approved = status === 'APPROVED' || status === 'PAID'

  return (
    <div className="py-5">
      {!approved && (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 text-warning" />
          This run isn’t approved yet. Documents are watermarked DRAFT or named UNAPPROVED, and the bank payment documents unlock after approval.
        </p>
      )}
      {missingCompany.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Company settings are missing {missingCompany.join(', ')}, so those parts of the documents show placeholders. An administrator can add them in{' '}
            <Link href="/portal/financial/config" className="font-medium text-primary hover:underline">
              Settings
            </Link>
            .
          </span>
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {(Object.keys(EXPORT_TYPES) as ExportType[]).map((type) => {
          const meta = EXPORT_TYPES[type]
          const locked = meta.requiresApproval && !approved
          const Icon = meta.formats[0] === 'pdf' ? FileText : FileSpreadsheet
          return (
            <li key={type} className="flex items-start gap-3 rounded-lg border border-border p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{meta.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!canExport ? (
                    <span className="text-xs text-subtlest">You don’t have permission to export.</span>
                  ) : locked ? (
                    <span className={cn(button.default, 'pointer-events-none opacity-50')}>
                      <Lock className="size-4" />
                      Available after approval
                    </span>
                  ) : (
                    <>
                      {meta.formats.map((format, index) => (
                        <a key={format} href={`${base}/export/${type}?format=${format}`} className={index === 0 ? button.default : button.subtle}>
                          <Download className="size-4" />
                          {format === 'pdf' && meta.pdfLabel ? meta.pdfLabel : FORMAT_LABELS[format]}
                        </a>
                      ))}
                      {meta.formats.includes('pdf') && (
                        <a href={`${base}/export/${type}?format=pdf&inline=1`} target="_blank" rel="noreferrer" className={button.subtle}>
                          <Eye className="size-4" />
                          Preview
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <h3 className="mt-8 text-base font-semibold">Export history</h3>
      {reports.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing has been exported from this run yet.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Document
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Exported by
              </th>
              <th scope="col" className="py-2 pl-4 font-semibold">
                When
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-b border-border">
                <td className="py-2 pr-4">
                  {report.title}
                  {report.description && <span className="ml-2 text-xs text-warning">{report.description}</span>}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{actorName(report.generatedBy)}</td>
                <td className="num py-2 pl-4 text-muted-foreground">{dateTime(report.generatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
