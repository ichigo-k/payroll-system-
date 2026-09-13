import { CircleCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { button } from '@/components/app/styles'
import { requirePermission } from '@/lib/access'
import { actorName } from '@/lib/audit-format'
import { markChecklistVisit } from '@/lib/checklists'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Approval queue' }

const dateTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default async function ApprovalsPage() {
  const actor = await requirePermission('payroll.approve')
  if (!actor) return <NoPermission title="You can’t approve payroll" description="The approval queue is for payroll approvers." />

  await markChecklistVisit(actor, ['approver.review-queue'])
  const [runs, pendingTax, config] = await Promise.all([
    prisma.payrollRun.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'asc' },
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        decisions: { select: { userId: true, round: true, decision: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.taxConfiguration.count({ where: { OR: [{ approvedAt: null }, { pendingChanges: { not: null } }] } }),
    prisma.systemConfig.findFirst({ where: { isActive: true }, select: { requiredApprovals: true } }),
  ])
  const required = Math.max(1, config?.requiredApprovals ?? 1)

  const rows = await Promise.all(
    runs.map(async (run) => {
      const round = run.decisions.filter((d) => d.round === run.submissionRound && d.decision === 'APPROVED')
      const flagged = await prisma.payrollDetail.count({ where: { payrollRunId: run.id, NOT: { flags: '[]' } } })
      const yours =
        run.submittedById === actor.id
          ? 'You submitted it'
          : round.some((d) => d.userId === actor.id)
            ? 'You approved'
            : run.requestedReviewerId === actor.id
              ? 'Review requested from you'
              : 'Needs your review'
      return { run, approvals: round.length, flagged, yours }
    }),
  )

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Payroll' }, { label: 'Approval queue', href: '/portal/financial/approvals' }]}
        title="Approval queue"
        description={`Runs waiting for review, oldest first. Your approval policy needs ${required} ${required === 1 ? 'approval' : 'approvals'} per run.`}
      />

      {pendingTax > 0 && (
        <div role="note" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-sm">
          <p>
            {pendingTax} tax {pendingTax === 1 ? 'configuration is' : 'configurations are'} waiting for activation.
          </p>
          <Link href="/portal/financial/tax" className={button.default}>
            Review tax configuration
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <CircleCheck className="mx-auto size-8 text-success" strokeWidth={1.5} />
          <p className="mt-3 text-base font-semibold">Nothing to review</p>
          <p className="mt-1 text-sm text-muted-foreground">You’ll get a notification and an email when a payroll run is submitted.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Period
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Submitted
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
                  Net pay
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Approvals
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Flags
                </th>
                <th scope="col" className="py-2 pl-4 font-semibold">
                  You
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ run, approvals, flagged, yours }) => (
                <tr key={run.id} className="border-b border-border hover:bg-muted">
                  <td className="py-3 pr-4">
                    <Link href={`/portal/financial/payroll/${run.id}`} className="font-medium text-primary hover:underline">
                      {periodLabel(run.month, run.year)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {run.headcount} employees{run.submissionRound > 1 && `, version ${run.submissionRound}`}
                      {run._count.comments > 0 && `, ${run._count.comments} comments`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {run.submittedBy ? actorName(run.submittedBy) : '-'}
                    {run.submittedAt && <p className="num text-xs">{dateTime(run.submittedAt)}</p>}
                  </td>
                  <td className="num px-4 py-3 text-right font-medium">{formatCurrency(Number(run.totalNetPay))}</td>
                  <td className="num px-4 py-3">
                    {approvals} of {required}
                  </td>
                  <td className="px-4 py-3">{flagged > 0 ? <span className="text-warning">{flagged} lines</span> : <span className="text-subtlest">None</span>}</td>
                  <td className="py-3 pl-4">
                    {yours === 'Needs your review' || yours === 'Review requested from you' ? (
                      <StatusBadge status="SUBMITTED" />
                    ) : (
                      <span className="text-muted-foreground">{yours}</span>
                    )}
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
