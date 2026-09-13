import type { PayrollStatus, Prisma } from '@prisma/client'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ListTabs, queryHref } from '@/components/app/list-tabs'
import { NoPermission } from '@/components/app/no-permission'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/pagination'
import { StatusBadge } from '@/components/app/status-badge'
import { button, link } from '@/components/app/styles'
import { can, requirePermission } from '@/lib/access'
import { parsePage } from '@/lib/pagination'
import { formatCurrency } from '@/lib/payroll'
import { periodLabel } from '@/lib/payroll-runs'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Payroll runs' }

const VIEWS: Record<string, { label: string; statuses?: PayrollStatus[] }> = {
  all: { label: 'All runs' },
  draft: { label: 'Drafts', statuses: ['DRAFT'] },
  submitted: { label: 'Awaiting approval', statuses: ['SUBMITTED'] },
  approved: { label: 'Approved', statuses: ['APPROVED'] },
  paid: { label: 'Paid', statuses: ['PAID'] },
}

function who(user: { firstName: string | null; lastName: string | null; email: string } | null) {
  return user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : '-'
}

export default async function PayrollRunsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('payroll.view')
  if (!actor) return <NoPermission title="You can’t view payroll" description="Payroll runs are available to preparers, approvers and auditors." />

  const raw = await searchParams
  const view = typeof raw.view === 'string' && raw.view in VIEWS ? raw.view : 'all'
  const { page, pageSize, skip, take } = parsePage(raw)
  const current = { view: view === 'all' ? undefined : view, size: typeof raw.size === 'string' ? raw.size : undefined }

  const where = (key: string): Prisma.PayrollRunWhereInput => (VIEWS[key].statuses ? { status: { in: VIEWS[key].statuses } } : {})
  const keys = Object.keys(VIEWS)
  const [runs, total, ...counts] = await Promise.all([
    prisma.payrollRun.findMany({
      where: where(view),
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      skip,
      take,
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        submittedBy: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.payrollRun.count({ where: where(view) }),
    ...keys.map((key) => prisma.payrollRun.count({ where: where(key) })),
  ])

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Payroll' }, { label: 'Payroll runs', href: '/portal/financial/payroll' }]}
        title="Payroll runs"
        description="Every run moves from draft to submitted, approved and paid. Open a run to see its employees, history and documents."
        actions={
          can(actor.role, 'payroll.prepare') && (
            <Link href="/portal/financial/payroll/new" className={button.primary}>
              <Plus className="size-4" />
              New payroll run
            </Link>
          )
        }
      />

      <ListTabs
        label="Payroll views"
        tabs={keys.map((key, i) => ({
          key,
          label: VIEWS[key].label,
          count: counts[i],
          active: key === view,
          href: queryHref('/portal/financial/payroll', current, { view: key === 'all' ? undefined : key }),
        }))}
      />

      {runs.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-input px-6 py-14 text-center">
          <p className="text-base font-semibold">{view === 'all' ? 'No payroll runs yet' : `No runs in ${VIEWS[view].label.toLowerCase()}`}</p>
          <p className="mx-auto mt-1 max-w-[52ch] text-sm text-muted-foreground">
            {can(actor.role, 'payroll.prepare')
              ? 'Start a run for a pay period. We’ll calculate pay for everyone with a salary set up.'
              : 'Runs appear here once a preparer starts one.'}
          </p>
          {view !== 'all' && (
            <Link href="/portal/financial/payroll" className={cn(link, 'mt-3 inline-block text-sm')}>
              Show all runs
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Period
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Employees
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Net pay
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Prepared by
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Last update
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border hover:bg-muted">
                    <td className="py-2.5 pr-4">
                      <Link href={`/portal/financial/payroll/${run.id}`} className="font-medium text-primary hover:underline">
                        {periodLabel(run.month, run.year)}
                      </Link>
                      {run._count.comments > 0 && <span className="ml-2 text-xs text-muted-foreground">{run._count.comments} comments</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status} />
                      {run.status === 'DRAFT' && run.submissionRound > 0 && <span className="ml-1.5 text-xs text-warning">Changes requested</span>}
                    </td>
                    <td className="num px-4 py-2.5 text-right">{run.headcount}</td>
                    <td className="num px-4 py-2.5 text-right font-medium">{formatCurrency(Number(run.totalNetPay))}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{who(run.submittedBy ?? run.createdBy)}</td>
                    <td className="num px-4 py-2.5 text-muted-foreground">{run.updatedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} noun="runs" hrefFor={(p, size) => queryHref('/portal/financial/payroll', current, { page: p, size })} />
        </>
      )}
    </div>
  )
}
