import type { Metadata } from 'next'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { can, requirePermission } from '@/lib/access'
import { ACTION_LABELS, actorName, ENTITY_LABELS } from '@/lib/audit-format'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { ROLE_INFO } from '@/lib/roles'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button, link } from '@/components/app/styles'
import { OnboardingChecklist } from '@/components/app/onboarding-checklist'
import { type ChecklistView, getChecklist } from '@/lib/checklists'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Home' }

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function Stat({ label, value, href, attention }: { label: string; value: string; href?: string; attention?: boolean }) {
  const body = (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('num mt-1 text-2xl font-semibold tracking-tight', attention ? 'text-warning' : 'text-foreground')}>{value}</dd>
    </>
  )
  return href ? (
    <Link href={href} className="block pr-4 hover:[&_dt]:text-primary hover:[&_dt]:underline">
      {body}
    </Link>
  ) : (
    <div className="pr-4">{body}</div>
  )
}

function RunList({ title, runs, empty, action }: { title: string; runs: { id: string; month: number; year: number; status: string; headcount: number; totalNetPay: unknown; note?: string }[]; empty: string; action?: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {runs.map((run) => (
            <li key={run.id}>
              <Link href={`/portal/financial/payroll/${run.id}`} className="flex items-center justify-between gap-4 px-1 py-3 transition-colors duration-150 hover:bg-muted">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{periodLabel(run.month, run.year)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{run.note ?? `${run.headcount} employees`}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="num text-sm font-medium">{formatCurrency(Number(run.totalNetPay))}</span>
                  <StatusBadge status={run.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function FinancialHomePage() {
  const actor = await currentActor()
  if (!actor) return <NoPermission title="You don’t have access" description="Ask an administrator to check your role." />

  const now = new Date()
  const firstName = actor.firstName
  const checklist = await getChecklist(actor)
  const role = actor.role

  return (
    <div>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description={`${ROLE_INFO[role].label}. ${now.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`}
        actions={
          can(role, 'payroll.prepare') ? (
            <Link href="/portal/financial/payroll/new" className={button.primary}>
              New payroll run
            </Link>
          ) : can(role, 'payroll.approve') ? (
            <Link href="/portal/financial/approvals" className={button.primary}>
              Open approval queue
            </Link>
          ) : can(role, 'users.manage') ? (
            <Link href="/portal/financial/users/invite" className={button.primary}>
              Invite user
            </Link>
          ) : null
        }
      />
      {role === 'PREPARER' && <PreparerHome checklist={checklist} />}
      {role === 'APPROVER' && <ApproverHome userId={actor.id} checklist={checklist} />}
      {role === 'ADMIN' && <AdminHome checklist={checklist} />}
      {role === 'AUDITOR' && <AuditorHome checklist={checklist} />}
    </div>
  )
}

async function currentActor() {
  // Any workspace role can see the home page
  return requirePermission('employees.view')
}

async function PreparerHome({ checklist }: { checklist: ChecklistView | null }) {
  const [activeEmployees, withSalary, drafts, submitted, sentBack, latest] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE', salaryConfigs: { some: {} } } }),
    prisma.payrollRun.findMany({ where: { status: 'DRAFT' }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 5, select: { id: true, month: true, year: true, status: true, headcount: true, totalNetPay: true, submissionRound: true, rejectionReason: true } }),
    prisma.payrollRun.count({ where: { status: 'SUBMITTED' } }),
    prisma.payrollRun.count({ where: { status: 'DRAFT', submissionRound: { gt: 0 } } }),
    prisma.payrollRun.findFirst({ where: { status: { in: ['APPROVED', 'PAID'] } }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
  ])
  const approvedToPay = await prisma.payrollRun.findMany({ where: { status: 'APPROVED' }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 3, select: { id: true, month: true, year: true, status: true, headcount: true, totalNetPay: true } })

  return (
    <>
      <dl className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        <Stat label="Active employees" value={String(activeEmployees)} href="/portal/financial/employees?view=active" />
        <Stat label="Without a salary" value={String(activeEmployees - withSalary)} href="/portal/financial/salary?view=missing" attention={activeEmployees - withSalary > 0} />
        <Stat label="Sent back for changes" value={String(sentBack)} href="/portal/financial/payroll?view=draft" attention={sentBack > 0} />
        <Stat label="Awaiting approval" value={String(submitted)} href="/portal/financial/payroll?view=submitted" />
      </dl>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid content-start gap-8">
          <RunList
            title="Drafts"
            empty="No drafts. Start a run when you’re ready to prepare pay."
            runs={drafts.map((r) => ({ ...r, note: r.submissionRound > 0 && r.rejectionReason ? `Changes requested: ${r.rejectionReason}` : undefined }))}
            action={
              <Link href="/portal/financial/payroll" className={cn(link, 'text-sm')}>
                All runs
              </Link>
            }
          />
          {approvedToPay.length > 0 && <RunList title="Approved, ready to pay" empty="" runs={approvedToPay} />}
          {latest && (
            <p className="text-sm text-muted-foreground">
              Last approved run: {periodLabel(latest.month, latest.year)}, {formatCurrency(Number(latest.totalNetPay))} net pay.
            </p>
          )}
        </div>
        <div className="xl:border-l xl:border-border xl:pl-8">
          {checklist && <OnboardingChecklist checklist={checklist} />}
        </div>
      </div>
    </>
  )
}

async function ApproverHome({ userId, checklist }: { userId: string; checklist: ChecklistView | null }) {
  const [waiting, pendingTax, approvedThisYear, recent] = await Promise.all([
    prisma.payrollRun.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'asc' },
      select: { id: true, month: true, year: true, status: true, headcount: true, totalNetPay: true, submittedById: true, requestedReviewerId: true, submissionRound: true, decisions: { select: { userId: true, round: true } } },
    }),
    prisma.taxConfiguration.count({ where: { OR: [{ approvedAt: null }, { pendingChanges: { not: null } }] } }),
    prisma.payrollRun.count({ where: { status: { in: ['APPROVED', 'PAID'] }, year: new Date().getFullYear() } }),
    prisma.payrollRun.findMany({ where: { status: { in: ['APPROVED', 'PAID'] } }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 4, select: { id: true, month: true, year: true, status: true, headcount: true, totalNetPay: true } }),
  ])
  const needsYou = waiting.filter((r) => r.submittedById !== userId && !r.decisions.some((d) => d.userId === userId && d.round === r.submissionRound))

  return (
    <>
      <dl className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        <Stat label="Waiting for you" value={String(needsYou.length)} href="/portal/financial/approvals" attention={needsYou.length > 0} />
        <Stat label="Tax changes to review" value={String(pendingTax)} href="/portal/financial/tax" attention={pendingTax > 0} />
        <Stat label={`Runs approved in ${new Date().getFullYear()}`} value={String(approvedThisYear)} />
        <Stat label="Audit log" value="View" href="/portal/financial/audit" />
      </dl>
      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-8">
        <RunList
          title="Needs your review"
          empty="Nothing waiting. You’ll get a notification and an email when a run is submitted."
          runs={needsYou.map((r) => ({ ...r, note: r.requestedReviewerId === userId ? 'Review requested from you' : `${r.headcount} employees` }))}
        />
        <RunList title="Recently approved" empty="No approved runs yet." runs={recent} />
        </div>
        <div className="xl:border-l xl:border-border xl:pl-8">{checklist && <OnboardingChecklist checklist={checklist} />}</div>
      </div>
    </>
  )
}

async function AdminHome({ checklist }: { checklist: ChecklistView | null }) {
  const [byRole, invited, deactivated, approvers, events] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], where: { status: 'active' }, _count: true }),
    prisma.user.count({ where: { status: 'active', lastLogin: null, role: { not: 'EMPLOYEE' } } }),
    prisma.user.count({ where: { status: { not: 'active' } } }),
    prisma.user.count({ where: { role: 'APPROVER', status: 'active' } }),
    prisma.auditLog.findMany({ where: { action: { notIn: ['LOGIN', 'LOGOUT'] } }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { timestamp: 'desc' }, take: 8 }),
  ])
  const count = (role: string) => byRole.find((r) => r.role === role)?._count ?? 0
  const preparers = count('PREPARER')

  return (
    <>
      <dl className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        <Stat label="Preparers" value={String(preparers)} href="/portal/financial/users?view=finance" attention={preparers === 0} />
        <Stat label="Approvers" value={String(approvers)} href="/portal/financial/users?view=finance" attention={approvers === 0} />
        <Stat label="Invited, not signed in" value={String(invited)} href="/portal/financial/users" />
        <Stat label="Deactivated" value={String(deactivated)} href="/portal/financial/users?view=deactivated" />
      </dl>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Recent activity">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent activity</h2>
            <Link href="/portal/financial/audit" className={cn(link, 'text-sm')}>
              Audit log
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{actorName(e.user)}</span> <span className="text-muted-foreground">{(ACTION_LABELS[e.action] ?? e.action).toLowerCase()}</span> {(ENTITY_LABELS[e.entityType] ?? e.entityType).toLowerCase()}
                  </span>
                  <span className="num shrink-0 text-xs text-subtlest">{dateTime(e.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="xl:border-l xl:border-border xl:pl-8">
          {(preparers === 0 || approvers === 0) && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              Payroll needs at least one preparer and one approver, and they must be different people.
            </p>
          )}
          {checklist && <OnboardingChecklist checklist={checklist} />}
        </div>
      </div>
    </>
  )
}

async function AuditorHome({ checklist }: { checklist: ChecklistView | null }) {
  const [runs, exports, events] = await Promise.all([
    prisma.payrollRun.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 5, select: { id: true, month: true, year: true, status: true, headcount: true, totalNetPay: true } }),
    prisma.report.count(),
    prisma.auditLog.count({ where: { timestamp: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
  ])
  return (
    <>
      <dl className="grid grid-cols-2 gap-y-5 border-y border-border py-5 lg:grid-cols-3">
        <Stat label="Audit events, last 30 days" value={String(events)} href="/portal/financial/audit" />
        <Stat label="Documents exported" value={String(exports)} href="/portal/financial/reports" />
        <Stat label="Payroll runs" value="View" href="/portal/financial/payroll" />
      </dl>
      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <RunList title="Recent payroll runs" empty="No payroll runs yet." runs={runs} />
        <div className="xl:border-l xl:border-border xl:pl-8">{checklist && <OnboardingChecklist checklist={checklist} />}</div>
      </div>
    </>
  )
}
